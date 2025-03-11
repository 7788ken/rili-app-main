/**
 * 日程模型 - 修改版：适用于本地优先存储模式
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db').sequelize;

const Schedule = sequelize.define('Schedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  localId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'local_id',
    comment: '本地设备上的唯一标识符'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  location: {
    type: DataTypes.STRING
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_time'
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'end_time'
  },
  isAllDay: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_all_day'
  },
  color: {
    type: DataTypes.STRING
  },
  reminder: {
    type: DataTypes.INTEGER
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_completed',
    comment: '任务是否已完成'
  },
  calendarId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'calendar_id',
    references: {
      model: 'calendars',
      key: 'id'
    }
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'device_id',
    comment: '创建/最后修改设备的唯一标识符'
  },
  syncStatus: {
    type: DataTypes.ENUM('new', 'synced', 'updated', 'deleted'),
    defaultValue: 'new',
    field: 'sync_status',
    comment: '同步状态：新建、已同步、已更新、已删除'
  },
  lastSynced: {
    type: DataTypes.DATE,
    field: 'last_synced',
    comment: '最后同步时间'
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_deleted',
    comment: '软删除标记'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'schedules',
  timestamps: true,
  underscored: true
});

// 实例方法：检查日程是否已过期
Schedule.prototype.isExpired = function() {
  return new Date(this.endTime) < new Date();
};

// 实例方法：检查日程是否即将开始
Schedule.prototype.isUpcoming = function(minutes = 30) {
  const now = new Date();
  const startTime = new Date(this.startTime);
  const diffInMinutes = Math.floor((startTime - now) / (1000 * 60));
  return diffInMinutes > 0 && diffInMinutes <= minutes;
};

// 实例方法：获取日程持续时间（分钟）
Schedule.prototype.getDuration = function() {
  const startTime = new Date(this.startTime);
  const endTime = new Date(this.endTime);
  return Math.floor((endTime - startTime) / (1000 * 60));
};

// 静态方法：获取特定日期范围内的日程
Schedule.findByDateRange = function(calendarId, startDate, endDate) {
  return this.findAll({
    where: {
      calendarId,
      isDeleted: false,
      startTime: {
        [sequelize.Sequelize.Op.lt]: endDate
      },
      endTime: {
        [sequelize.Sequelize.Op.gt]: startDate
      }
    }
  });
};

// 静态方法：获取特定日历的所有日程
Schedule.findByCalendarId = function(calendarId) {
  return this.findAll({
    where: { 
      calendarId,
      isDeleted: false
    }
  });
};

// 静态方法：根据本地ID和设备ID查找日程
Schedule.findByLocalIdAndDevice = function(localId, deviceId) {
  return this.findOne({
    where: { 
      localId,
      deviceId
    }
  });
};

module.exports = Schedule; 