/**
 * 数据库配置文件
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

// 环境变量配置
const env = process.env.NODE_ENV || 'development';
console.log('当前运行环境:', env);

// 数据库配置
const config = {
  host: process.env.DB_HOST || '103.252.118.223',
  user: process.env.DB_USER || 'dd_calendarapper',
  password: process.env.DB_PASSWORD || 'AThiHnidXRGYEPAY',
  database: process.env.DB_NAME || 'ddcalendarapp',
  dialect: 'mysql',
  logging: env === 'development' ? (sql) => {
    // 提取纯SQL语句
    const pureSql = sql.replace('Executing (default): ', '');
    // 格式化 SQL（简单替换换行和缩进）
    const formattedSql = pureSql
      .replace(/SELECT/g, '\nSELECT')
      .replace(/FROM/g, '\nFROM')
      .replace(/WHERE/g, '\nWHERE')
      .replace(/ORDER BY/g, '\nORDER BY')
      .replace(/GROUP BY/g, '\nGROUP BY')
      .replace(/HAVING/g, '\nHAVING')
      .replace(/LIMIT/g, '\nLIMIT')
      .replace(/INSERT/g, '\nINSERT')
      .replace(/UPDATE/g, '\nUPDATE')
      .replace(/DELETE/g, '\nDELETE')
      // 添加 JOIN 相关格式化
      .replace(/LEFT JOIN/g, '\n  LEFT JOIN')
      .replace(/RIGHT JOIN/g, '\n  RIGHT JOIN')
      .replace(/INNER JOIN/g, '\n  INNER JOIN')
      .replace(/OUTER JOIN/g, '\n  OUTER JOIN')
      .replace(/JOIN/g, '\n  JOIN')
      .replace(/ON\s/g, '\n    ON ')
      // 添加子查询格式化
      .replace(/\(/g, '\n  (')
      .replace(/\)/g, ')\n')
      // VALUES 语句格式化
      .replace(/VALUES/g, '\nVALUES')
      // 常见聚合函数格式化
      .replace(/(COUNT|SUM|AVG|MAX|MIN)\(/g, '\n  $1(')
      // SET 语句格式化
      .replace(/SET/g, '\nSET')
      // AND/OR 条件格式化
      .replace(/\sAND\s/g, '\n  AND ')
      .replace(/\sOR\s/g, '\n  OR ');
    
    console.log('\n' + formattedSql + '\n');
  } : false,
  dialectOptions: {
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: 'utf8mb4',
    dateStrings: false,
    typeCast: function (field, next) {
      if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
        return new Date(field.string());
      }
      return next();
    },
    connectTimeout: 10000
  },
  timezone: '+08:00',
  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '0'),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000'),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000'),
    handleDisconnects: true
  },
  retry: {
    max: parseInt(process.env.DB_RETRY_MAX || '3'),
    timeout: parseInt(process.env.DB_RETRY_TIMEOUT || '5000'),
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /TimeoutError/
    ]
  },
  benchmark: true,
  logQueryParameters: true
};

console.log('使用数据库配置:', {
  host: config.host,
  user: config.user,
  database: config.database
});

// 创建数据库连接
const sequelize = new Sequelize(
  config.database,
  config.user,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    logging: config.logging,
    dialectOptions: config.dialectOptions,
    timezone: config.timezone,
    define: config.define,
    pool: config.pool,
    retry: config.retry,
    benchmark: config.benchmark,
    logQueryParameters: config.logQueryParameters
  }
);

// 测试数据库连接
const connectDB = async () => {
  let retryCount = 0;
  const maxRetries = config.retry.max;

  const tryConnect = async () => {
    try {
      await sequelize.authenticate();
      console.log(`\n数据库连接成功 ✅`);
      console.log(`服务器: ${config.host}`);
      console.log(`数据库: ${config.database}`);
      console.log(`用户名: ${config.user}`);
      console.log(`环境: ${env}`);
      console.log(`连接池配置: 最大连接数=${config.pool.max}, 最小连接数=${config.pool.min}`);
      console.log(`重试配置: 最大重试次数=${config.retry.max}, 重试超时=${config.retry.timeout}ms\n`);
      
      // 添加定期检查连接池状态的功能
      setInterval(() => {
        try {
          const pool = sequelize.connectionManager.pool;
          if (pool) {
            // 安全地获取连接池信息
            const poolMetrics = [{
              指标: '当前值',
              总连接数: (pool._allConnections || []).length,
              活跃连接: (pool._connectionsInUse || []).length,
              空闲连接: (pool._idleConnections || []).length,
              最大连接数: config.pool.max,
              等待连接数: (pool._connectionQueue || []).length,
              健康状态: (pool._connectionsInUse || []).length < config.pool.max ? '正常' : '繁忙',
              检查时间: new Date().toLocaleTimeString()
            }];
            
            console.log('\n连接池状态报告 -----');
            console.table(poolMetrics);
            console.log('------------------------\n');
          }
        } catch (error) {
          console.error('检查连接池状态失败:', error.message);
          // 输出更详细的错误信息以便调试
          console.error('错误堆栈:', error.stack);
          console.error('连接池对象:', sequelize.connectionManager.pool ? '存在' : '不存在');
        }
      }, 60000); // 每1分钟检查一次

      return true;
    } catch (error) {
      retryCount++;
      console.error(`\n数据库连接失败 (第 ${retryCount}/${maxRetries} 次尝试) ❌`);
      console.error('错误类型:', error.name);
      console.error('错误信息:', error.message);
      console.error('服务器:', config.host);
      console.error('数据库:', config.database);
      console.error('用户名:', config.user);
      console.error('环境:', env);
      
      if (retryCount < maxRetries) {
        console.log(`等待 ${config.retry.timeout}ms 后重试...\n`);
        await new Promise(resolve => setTimeout(resolve, config.retry.timeout));
        return tryConnect();
      }
      
      console.error('已达到最大重试次数，连接失败\n');
      return false;
    }
  };

  return tryConnect();
};

module.exports = {
  sequelize,
  connectDB
}; 