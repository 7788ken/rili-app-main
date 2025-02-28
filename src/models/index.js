/**
 * 数据模型索引文件 - 重构版：无登录系统
 */
const sequelize = require('../config/db').sequelize;
const Calendar = require('./Calendar');
const Schedule = require('./Schedule');
const Device = require('./Device'); // 修正：使用Device.js文件

// 定义模型关联
// 日历与设备关系 (一个设备可以有多个日历)
Calendar.belongsTo(Device, { foreignKey: 'deviceId', targetKey: 'deviceId', as: 'device' });
Device.hasMany(Calendar, { foreignKey: 'deviceId', sourceKey: 'deviceId', as: 'calendars' });

// 日程与日历关系 (一个日历可以有多个日程)
Schedule.belongsTo(Calendar, { foreignKey: 'calendarId', as: 'calendar' });
Calendar.hasMany(Schedule, { foreignKey: 'calendarId', as: 'schedules' });

// 日程与设备关系 (一个设备可以创建多个日程)
Schedule.belongsTo(Device, { foreignKey: 'deviceId', targetKey: 'deviceId', as: 'device' });
Device.hasMany(Schedule, { foreignKey: 'deviceId', sourceKey: 'deviceId', as: 'schedules' });

// 同步所有模型到数据库
const syncModels = async () => {
  try {
    await sequelize.sync({ alter: true }); // 使用alter选项更新表结构而不是重新创建
    console.log('数据库模型已同步');
  } catch (error) {
    console.error('数据库模型同步失败:', error);
  }
};

module.exports = {
  sequelize,
  syncModels,
  Calendar,
  Schedule,
  Device
}; 