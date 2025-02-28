/**
 * 重构版分享控制器 - 无需登录的日历分享系统
 */
const crypto = require('crypto');
const { Calendar, Schedule, Device } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * 生成唯一分享码
 * @returns {string} 12位随机字符串
 */
const generateUniqueShareCode = () => {
  return crypto.randomBytes(6).toString('hex'); // 生成12个字符的随机字符串
};

/**
 * @desc    分享本地日历到云端并生成分享码
 * @route   POST /api/share
 * @access  公开
 */
const shareCalendar = async (req, res) => {
  try {
    const { 
      deviceId, 
      deviceName, 
      platform, 
      calendar, 
      schedules, 
      editPassword 
    } = req.body;

    if (!deviceId || !calendar) {
      return errorResponse(res, 400, '缺少必要参数，deviceId和calendar字段为必填');
    }

    // 注册或更新设备信息
    const device = await Device.findOrCreateByDeviceId({
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      platform: platform || 'Unknown Platform'
    });

    // 生成唯一分享码
    const shareCode = generateUniqueShareCode();
    
    // 创建或更新日历
    let dbCalendar;
    if (calendar.id) {
      // 尝试查找已存在的日历
      dbCalendar = await Calendar.findOne({
        where: { 
          deviceId: device.deviceId,
          id: calendar.id
        }
      });
    }

    if (!dbCalendar) {
      // 创建新日历
      dbCalendar = await Calendar.create({
        title: calendar.title,
        description: calendar.description || '',
        color: calendar.color || '#3498db',
        deviceId: device.deviceId,
        isShared: true,
        shareCode,
        shareExpire: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        editPassword: editPassword || null,
        lastSync: new Date()
      });
    } else {
      // 更新已有日历
      dbCalendar.title = calendar.title;
      dbCalendar.description = calendar.description || '';
      dbCalendar.color = calendar.color || '#3498db';
      dbCalendar.isShared = true;
      dbCalendar.shareCode = shareCode;
      dbCalendar.shareExpire = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      dbCalendar.editPassword = editPassword || null;
      dbCalendar.lastSync = new Date();
      await dbCalendar.save();
    }

    // 处理日程列表
    if (schedules && Array.isArray(schedules) && schedules.length > 0) {
      for (const schedule of schedules) {
        // 确保 isCompleted 是布尔值
        const isCompleted = schedule.isCompleted === true || schedule.isCompleted === 'true' || schedule.isCompleted === 1;
        
        await Schedule.create({
          localId: schedule.localId || crypto.randomBytes(8).toString('hex'),
          title: schedule.title,
          description: schedule.description || '',
          location: schedule.location || '',
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isAllDay: schedule.isAllDay || false,
          color: schedule.color || dbCalendar.color,
          reminder: schedule.reminder,
          isCompleted: isCompleted,
          calendarId: dbCalendar.id,
          deviceId: device.deviceId,
          syncStatus: schedule.syncStatus || 'synced', // 使用传入的同步状态，如果没有则默认为'synced'
          lastSynced: new Date()
        });
      }
    }

    return successResponse(
      res,
      201,
      '日历已成功分享',
      {
        calendar: {
          id: dbCalendar.id,
          title: dbCalendar.title,
          description: dbCalendar.description,
          color: dbCalendar.color,
          isShared: true,
          shareCode: dbCalendar.shareCode,
          shareExpire: dbCalendar.shareExpire,
          lastSync: dbCalendar.lastSync
        },
        shareUrl: `${req.protocol}://${req.get('host')}/calendar/${shareCode}`
      }
    );
  } catch (error) {
    console.error('分享日历出错:', error);
    return errorResponse(res, 500, '分享日历失败', error.message);
  }
};

/**
 * @desc    通过分享码获取日历和日程
 * @route   GET /api/share/:shareCode
 * @access  公开
 */
const getCalendarByShareCode = async (req, res) => {
  try {
    const { shareCode } = req.params;

    const calendar = await Calendar.findOne({ 
      where: { shareCode },
      include: [{ 
        model: Device, 
        as: 'device', 
        attributes: ['deviceId', 'deviceName', 'platform'] 
      }]
    });

    if (!calendar) {
      return errorResponse(res, 404, '未找到该分享日历，请检查分享码是否正确');
    }

    if (!calendar.isShareCodeValid()) {
      return errorResponse(res, 410, '分享码已过期');
    }

    // 获取该日历下的所有日程
    const schedules = await Schedule.findAll({
      where: { 
        calendarId: calendar.id,
        isDeleted: false
      },
      order: [['startTime', 'ASC']]
    });

    return successResponse(
      res,
      200,
      '获取分享日历成功',
      {
        calendar: {
          id: calendar.id,
          title: calendar.title,
          description: calendar.description,
          color: calendar.color,
          isShared: calendar.isShared,
          shareCode: calendar.shareCode,
          shareExpire: calendar.shareExpire,
          requiresPassword: !!calendar.editPassword,
          createdAt: calendar.createdAt,
          deviceName: calendar.device ? calendar.device.deviceName : '未知设备'
        },
        schedules: schedules.map(schedule => ({
          id: schedule.id,
          localId: schedule.localId,
          title: schedule.title,
          description: schedule.description,
          location: schedule.location,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isAllDay: schedule.isAllDay,
          color: schedule.color,
          reminder: schedule.reminder,
          isCompleted: Boolean(schedule.isCompleted)
        })),
        count: schedules.length
      }
    );
  } catch (error) {
    console.error('获取分享日历出错:', error);
    return errorResponse(res, 500, '获取分享日历失败', error.message);
  }
};

/**
 * @desc    导入分享的日历
 * @route   POST /api/share/:shareCode/import
 * @access  公开
 */
const importSharedCalendar = async (req, res) => {
  try {
    const { shareCode } = req.params;
    const { deviceId, deviceName, platform } = req.body;

    if (!deviceId) {
      return errorResponse(res, 400, '缺少必要参数，deviceId为必填');
    }

    // 注册或更新设备信息
    const device = await Device.findOrCreateByDeviceId({
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      platform: platform || 'Unknown Platform'
    });

    // 查找分享的日历
    const sharedCalendar = await Calendar.findOne({ 
      where: { shareCode }
    });

    if (!sharedCalendar) {
      return errorResponse(res, 404, '未找到该分享日历，请检查分享码是否正确');
    }

    if (!sharedCalendar.isShareCodeValid()) {
      return errorResponse(res, 410, '分享码已过期');
    }

    // 获取该日历下的所有日程
    const schedules = await Schedule.findAll({
      where: { 
        calendarId: sharedCalendar.id,
        isDeleted: false
      }
    });

    return successResponse(
      res,
      200,
      '成功导入分享日历',
      {
        calendar: {
          id: sharedCalendar.id,
          title: sharedCalendar.title,
          description: sharedCalendar.description,
          color: sharedCalendar.color,
          shareCode: sharedCalendar.shareCode,
          originalDeviceId: sharedCalendar.deviceId
        },
        schedules: schedules.map(schedule => ({
          id: schedule.id,
          localId: schedule.localId,
          title: schedule.title,
          description: schedule.description,
          location: schedule.location,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isAllDay: schedule.isAllDay,
          color: schedule.color,
          reminder: schedule.reminder,
          isCompleted: Boolean(schedule.isCompleted)
        })),
        importedToDevice: {
          deviceId: device.deviceId,
          deviceName: device.deviceName
        }
      }
    );
  } catch (error) {
    console.error('导入分享日历出错:', error);
    return errorResponse(res, 500, '导入分享日历失败', error.message);
  }
};

/**
 * @desc    同步更新分享的日历
 * @route   POST /api/share/:shareCode/sync
 * @access  公开（可能需要密码）
 */
const syncSharedCalendar = async (req, res) => {
  try {
    const { shareCode } = req.params;
    const { 
      deviceId, 
      deviceName, 
      platform, 
      schedules, 
      password,
      title,
      description,
      color
    } = req.body;

    if (!deviceId || !schedules) {
      return errorResponse(res, 400, '缺少必要参数，deviceId和schedules字段为必填');
    }

    // 注册或更新设备信息
    const device = await Device.findOrCreateByDeviceId({
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      platform: platform || 'Unknown Platform'
    });

    // 查找分享的日历
    const sharedCalendar = await Calendar.findOne({ 
      where: { shareCode }
    });

    if (!sharedCalendar) {
      return errorResponse(res, 404, '未找到该分享日历，请检查分享码是否正确');
    }

    if (!sharedCalendar.isShareCodeValid()) {
      return errorResponse(res, 410, '分享码已过期');
    }

    // 如果日历设置了编辑密码，验证密码
    if (sharedCalendar.editPassword && !sharedCalendar.verifyPassword(password)) {
      return errorResponse(res, 403, '密码错误，无法修改日历');
    }

    // 更新日历信息（如果提供）
    if (title || description || color) {
      if (title) sharedCalendar.title = title;
      if (description !== undefined) sharedCalendar.description = description;
      if (color) sharedCalendar.color = color;
      sharedCalendar.lastSync = new Date();
      await sharedCalendar.save();
    }

    // 处理同步的日程
    const result = {
      added: 0,
      updated: 0,
      deleted: 0,
      skipped: 0
    };

    for (const schedule of schedules) {
      if (!schedule.localId) {
        result.skipped++;
        continue;
      }

      // 查找是否已存在该日程
      const existingSchedule = await Schedule.findOne({
        where: {
          calendarId: sharedCalendar.id,
          localId: schedule.localId
        }
      });

      if (schedule.syncStatus === 'deleted') {
        // 删除日程
        if (existingSchedule) {
          existingSchedule.isDeleted = true;
          existingSchedule.syncStatus = 'deleted';
          existingSchedule.lastSynced = new Date();
          await existingSchedule.save();
          result.deleted++;
        }
      } else if (existingSchedule) {
        // 确保 isCompleted 是布尔值
        const isCompleted = schedule.isCompleted === true || schedule.isCompleted === 'true' || schedule.isCompleted === 1;
        
        // 更新日程
        existingSchedule.title = schedule.title;
        existingSchedule.description = schedule.description || '';
        existingSchedule.location = schedule.location || '';
        existingSchedule.startTime = schedule.startTime;
        existingSchedule.endTime = schedule.endTime;
        existingSchedule.isAllDay = schedule.isAllDay || false;
        existingSchedule.color = schedule.color || sharedCalendar.color;
        existingSchedule.reminder = schedule.reminder;
        existingSchedule.isCompleted = isCompleted;
        existingSchedule.deviceId = device.deviceId; // 更新为最后修改的设备ID
        existingSchedule.lastSynced = new Date();
        await existingSchedule.save();
        result.updated++;
      } else {
        // 确保 isCompleted 是布尔值
        const isCompleted = schedule.isCompleted === true || schedule.isCompleted === 'true' || schedule.isCompleted === 1;
        
        // 创建新日程
        await Schedule.create({
          localId: schedule.localId,
          title: schedule.title,
          description: schedule.description || '',
          location: schedule.location || '',
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isAllDay: schedule.isAllDay || false,
          color: schedule.color || sharedCalendar.color,
          reminder: schedule.reminder,
          isCompleted: isCompleted,
          calendarId: sharedCalendar.id,
          deviceId: device.deviceId,
          syncStatus: schedule.syncStatus || 'synced', // 使用传入的同步状态，如果没有则默认为'synced'
          lastSynced: new Date()
        });
        result.added++;
      }
    }

    return successResponse(
      res,
      200,
      '日历同步成功',
      {
        calendar: {
          id: sharedCalendar.id,
          title: sharedCalendar.title,
          lastSync: new Date()
        },
        syncResult: result
      }
    );
  } catch (error) {
    console.error('同步日历出错:', error);
    return errorResponse(res, 500, '同步日历失败', error.message);
  }
};

module.exports = {
  shareCalendar,
  getCalendarByShareCode,
  importSharedCalendar,
  syncSharedCalendar
}; 