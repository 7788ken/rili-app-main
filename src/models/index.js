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

// 添加一个函数来处理日期转换
const convertDate = (date) => {
  if (!date) return null;
  if (date instanceof Date) return date;
  try {
    return new Date(date);
  } catch (e) {
    console.error('日期转换错误:', e);
    return null;
  }
};

// 简化修复，移除对hooks的修改
// const addDateHooks = (models) => {
//   Object.values(models).forEach(model => {
//     console.log(`为模型 ${model.name} 添加日期转换钩子`);
//     
//     // 添加afterFind钩子
//     const originalAfterFind = model.options.hooks.afterFind || function(result) { return result; };
//     model.options.hooks.afterFind = function(result) {
//       const processed = originalAfterFind.call(this, result);
//       
//       // 处理单个结果
//       const processInstance = (instance) => {
//         if (instance && instance.dataValues) {
//           if (instance.dataValues.created_at) {
//             instance.dataValues.createdAt = convertDate(instance.dataValues.created_at);
//             console.log(`转换 ${model.name} created_at:`, instance.dataValues.created_at, '为:', instance.dataValues.createdAt);
//           }
//           if (instance.dataValues.updated_at) {
//             instance.dataValues.updatedAt = convertDate(instance.dataValues.updated_at);
//             console.log(`转换 ${model.name} updated_at:`, instance.dataValues.updated_at, '为:', instance.dataValues.updatedAt);
//           }
//         }
//         return instance;
//       };
//       
//       // 处理结果集合
//       if (Array.isArray(processed)) {
//         processed.forEach(processInstance);
//       } else {
//         processInstance(processed);
//       }
//       
//       return processed;
//     };
//   });
// };

// 不再使用钩子
// const db = {
//   Calendar,
//   Schedule,
//   Device
// };
// addDateHooks(db);

module.exports = {
  sequelize,
  syncModels,
  Calendar,
  Schedule,
  Device
}; 