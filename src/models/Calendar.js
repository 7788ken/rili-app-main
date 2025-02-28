/**
 * 日历模型 - 修改版：无需用户登录，本地存储为主，支持云端分享
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;
const crypto = require('crypto');

const Calendar = sequelize.define('Calendar', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#3788d8'
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_public'
  },
  shareCode: {
    type: DataTypes.STRING,
    unique: true,
    field: 'share_code'
  },
  shareExpire: {
    type: DataTypes.DATE,
    field: 'share_expire'
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'device_id',
    comment: '创建设备的唯一标识符'
  },
  lastSync: {
    type: DataTypes.DATE,
    field: 'last_sync',
    comment: '最后同步时间'
  },
  isShared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_shared',
    comment: '是否已分享到云端'
  },
  editPassword: {
    type: DataTypes.STRING,
    field: 'edit_password',
    comment: '编辑密码，用于保护分享的日历'
  }
}, {
  tableName: 'calendars',
  timestamps: true,
  underscored: true
});

// 实例方法：生成分享码
Calendar.prototype.generateShareCode = function(expiresIn = 30) {
  // 生成随机分享码
  const shareCode = crypto.randomBytes(6).toString('hex');
  
  // 设置分享码
  this.shareCode = shareCode;
  
  // 设置过期时间（默认30天）
  this.shareExpire = new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000);
  
  // 标记为已分享
  this.isShared = true;
  
  return shareCode;
};

// 实例方法：检查分享码是否有效
Calendar.prototype.isShareCodeValid = function() {
  return this.shareCode && this.shareExpire && new Date(this.shareExpire) > new Date();
};

// 实例方法：验证编辑密码
Calendar.prototype.verifyPassword = function(password) {
  return !this.editPassword || this.editPassword === password;
};

module.exports = Calendar; 