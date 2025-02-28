/**
 * 设备模型 - 用于替代用户系统，无需登录即可使用日历
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'device_id',
    comment: '设备唯一标识符，由客户端生成并保存'
  },
  deviceName: {
    type: DataTypes.STRING,
    field: 'device_name',
    comment: '设备名称'
  },
  platform: {
    type: DataTypes.STRING,
    comment: '设备平台，如iOS, Android, Web等'
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_active',
    comment: '设备最后活跃时间'
  }
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true
});

// 实例方法：更新最后活跃时间
Device.prototype.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// 静态方法：查找或创建设备
Device.findOrCreateByDeviceId = async function(deviceInfo) {
  const { deviceId, deviceName, platform } = deviceInfo;
  
  const [device, created] = await this.findOrCreate({
    where: { deviceId },
    defaults: {
      deviceName: deviceName || `Device-${deviceId.substring(0, 6)}`,
      platform: platform || 'Unknown'
    }
  });
  
  if (!created) {
    // 更新设备信息和活跃时间
    device.lastActive = new Date();
    if (deviceName) device.deviceName = deviceName;
    if (platform) device.platform = platform;
    await device.save();
  }
  
  return device;
};

module.exports = Device; 