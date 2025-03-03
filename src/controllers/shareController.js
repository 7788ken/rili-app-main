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
      
      // 当添加了日程后，更新日历的时间戳
      dbCalendar.lastSync = new Date();
      // 由于 timestamps: true，这将自动更新 updated_at 字段
      await dbCalendar.save();
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
 * @desc    获取分享的日历和关联日程
 * @route   GET /api/share/:shareCode
 * @access  公开
 */
const getSharedCalendar = async (req, res) => {
  try {
    const { shareCode } = req.params;
    
    const calendar = await Calendar.findOne({
      where: { share_code: shareCode },
      include: [{
        model: Device,
        as: 'device',
        attributes: ['device_id', 'device_name', 'platform']
      }]
    });
    
    if (!calendar) {
      return res.status(404).json({
        success: false,
        message: '分享的日历不存在'
      });
    }
    
    // 验证分享码是否有效
    const now = new Date();
    const shareExpire = new Date(calendar.share_expire);
    
    if (shareExpire < now) {
      return res.status(410).json({
        success: false,
        message: '分享链接已过期'
      });
    }
    
    // 查询所有未删除的日程
    const schedules = await Schedule.findAll({
      where: {
        calendar_id: calendar.id,
        is_deleted: false
      },
      order: [['start_time', 'ASC']]
    });
    
    // 处理日期，转换为东八区时间并以YYYY-MM-DD HH:MM:SS格式返回
    const formatDates = (object) => {
      if (!object) return object;
      
      const result = { ...object };
      
      // 统一的日期格式转换函数
      const formatDate = (dateStr) => {
        try {
          const date = new Date(dateStr);
          // 转换为东八区时间
          date.setHours(date.getHours() + 8);
          // 格式化为YYYY-MM-DD HH:MM:SS
          return date.toISOString().replace('T', ' ').substring(0, 19);
        } catch (error) {
          console.error('日期格式化失败:', error, dateStr);
          return dateStr; // 出错时返回原始值
        }
      };
      
      if (result.created_at) {
        result.createdAt = formatDate(result.created_at);
        delete result.created_at;
      }
      
      if (result.updated_at) {
        result.updatedAt = formatDate(result.updated_at);
        delete result.updated_at;
      }
      
      // 处理其他日期字段
      if (result.share_expire) {
        result.shareExpire = formatDate(result.share_expire);
      }
      
      if (result.last_sync) {
        result.lastSync = formatDate(result.last_sync);
      }
      
      return result;
    };
    
    // 格式化日历数据
    const calendarData = formatDates(calendar.get({ plain: true }));
    
    // 格式化日程数据
    const formattedSchedules = schedules.map(schedule => {
      return formatDates(schedule.get({ plain: true }));
    });
    
    return res.json({
      success: true,
      message: '获取分享日历成功',
      data: {
        calendar: {
          id: calendarData.id,
          title: calendarData.title,
          description: calendarData.description || '',
          color: calendarData.color || '#3498db',
          isShared: calendarData.is_shared,
          shareCode: calendarData.share_code,
          shareExpire: calendarData.share_expire,
          requiresPassword: calendarData.edit_password ? true : false,
          deviceName: calendar.device ? calendar.device.device_name : 'Unknown Device',
          createdAt: calendarData.createdAt,
          updatedAt: calendarData.updatedAt
        },
        schedules: formattedSchedules,
        count: formattedSchedules.length
      }
    });
  } catch (error) {
    console.error('获取分享日历失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
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

    // 标记是否有任何日程变化
    let hasScheduleChanges = false;

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
          hasScheduleChanges = true;
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
        hasScheduleChanges = true;
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
        hasScheduleChanges = true;
      }
    }

    // 如果有任何日程变化，更新日历的时间戳
    if (hasScheduleChanges) {
      sharedCalendar.lastSync = new Date();
      // 由于 timestamps: true，这将自动更新 updated_at 字段
      await sharedCalendar.save();
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
  getSharedCalendar,
  importSharedCalendar,
  syncSharedCalendar
}; 