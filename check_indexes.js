/**
 * 检查数据库索引情况的脚本
 */
const { sequelize } = require('./src/config/db');

async function checkIndexes() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 查询devices表的索引
    const [devicesIndexes] = await sequelize.query(`SHOW INDEXES FROM devices`);
    console.log('devices表的索引:');
    console.log(JSON.stringify(devicesIndexes, null, 2));

    // 查询所有表的索引数量
    const [tables] = await sequelize.query(`SHOW TABLES`);
    console.log('\n所有表的索引数量:');
    
    for (const tableObj of tables) {
      const tableName = tableObj[Object.keys(tableObj)[0]];
      const [indexes] = await sequelize.query(`SHOW INDEXES FROM ${tableName}`);
      console.log(`${tableName}: ${indexes.length} 个索引`);
    }

    // 关闭连接
    await sequelize.close();
  } catch (error) {
    console.error('查询失败:', error);
  }
}

// 执行函数
checkIndexes(); 