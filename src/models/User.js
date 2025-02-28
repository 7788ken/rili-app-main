/**
 * 设备模型 - 替代原用户模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;
const crypto = require('crypto');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  deviceId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    field: 'device_id'
  },
  deviceName: {
    type: DataTypes.STRING,
    field: 'device_name'
  },
  platform: {
    type: DataTypes.STRING
  },
  lastActive: {
    type: DataTypes.DATE,
    field: 'last_active',
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true
});

// 静态方法：生成设备ID
Device.generateDeviceId = function() {
  return crypto.randomBytes(16).toString('hex');
};

// 静态方法：注册或更新设备
Device.registerOrUpdate = async function(deviceInfo) {
  const { deviceId, deviceName, platform } = deviceInfo;
  
  const [device, created] = await this.findOrCreate({
    where: { deviceId },
    defaults: {
      deviceName,
      platform,
      lastActive: new Date()
    }
  });
  
  if (!created) {
    // 如果设备已存在，更新最后活动时间
    device.lastActive = new Date();
    if (deviceName) device.deviceName = deviceName;
    if (platform) device.platform = platform;
    await device.save();
  }
  
  return device;
};

module.exports = Device; 