/**
 * 数据库配置文件
 */
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 数据库连接参数
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_NAME = process.env.DB_NAME || 'calendar_share_db';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'qwe123';

// 创建Sequelize实例
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  // 添加时区配置，使用东八区(UTC+8)，中国标准时间
  timezone: '+08:00',
  // 添加方言特定选项，使MySQL在写入时使用指定时区
  dialectOptions: {
    dateStrings: false,
    typeCast: function (field, next) {
      if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
        return field.string();
      }
      return next();
    }
  }
});

// 连接数据库
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(`MySQL数据库连接成功: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    
    // 在开发环境下同步模型（不要在生产环境使用force: true）
    if (process.env.NODE_ENV === 'development') {
      // 暂时禁用自动同步以避免Too many keys错误
      // await sequelize.sync({ alter: true });
      console.log('数据库模型同步已禁用，如需手动同步请使用SQL或修改此代码');
    }
    
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB }; 