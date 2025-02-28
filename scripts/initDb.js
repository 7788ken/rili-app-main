/**
 * 数据库初始化脚本
 * 用于创建和初始化MySQL数据库
 */
const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const mysql = require('mysql2/promise');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'calendar_share_db'
};

// 创建数据库连接（不指定数据库名）
const createDbConnection = async () => {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    console.log('MySQL连接成功');
    return connection;
  } catch (error) {
    console.error('MySQL连接失败:', error.message);
    process.exit(1);
  }
};

// 创建数据库
const createDatabase = async (connection) => {
  try {
    console.log(`正在创建数据库: ${dbConfig.database}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`数据库 ${dbConfig.database} 创建成功`);
  } catch (error) {
    console.error('创建数据库失败:', error.message);
    process.exit(1);
  }
};

// 初始化Sequelize模型
const initModels = async () => {
  try {
    console.log('正在初始化Sequelize模型...');
    
    // 创建Sequelize实例
    const sequelize = new Sequelize(
      dbConfig.database,
      dbConfig.user,
      dbConfig.password,
      {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: 'mysql',
        logging: false
      }
    );
    
    // 测试连接
    await sequelize.authenticate();
    console.log('Sequelize连接成功');
    
    // 导入模型
    const db = require('../src/models');
    
    // 同步模型到数据库
    console.log('正在同步模型到数据库...');
    await db.sequelize.sync({ force: true });
    console.log('模型同步成功');
    
    return db;
  } catch (error) {
    console.error('初始化Sequelize模型失败:', error.message);
    process.exit(1);
  }
};

// 创建初始管理员用户
const createAdminUser = async (db) => {
  try {
    console.log('正在创建管理员用户...');
    
    const adminUser = await db.User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: await db.User.hashPassword('admin123'),
      isAdmin: true
    });
    
    console.log(`管理员用户创建成功: ${adminUser.email}`);
  } catch (error) {
    console.error('创建管理员用户失败:', error.message);
  }
};

// 主函数
const initDb = async () => {
  console.log('开始初始化数据库...');
  
  // 创建数据库连接
  const connection = await createDbConnection();
  
  // 创建数据库
  await createDatabase(connection);
  
  // 关闭初始连接
  await connection.end();
  
  // 初始化模型
  const db = await initModels();
  
  // 创建管理员用户
  await createAdminUser(db);
  
  console.log('数据库初始化完成');
  process.exit(0);
};

// 执行初始化
initDb(); 