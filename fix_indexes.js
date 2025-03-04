/**
 * 修复数据库索引问题的脚本
 * 清理重复的索引，保留必要的索引
 */
const { sequelize } = require('./src/config/db');

async function fixIndexes() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 查询devices表的索引
    const [devicesIndexes] = await sequelize.query(`SHOW INDEXES FROM devices`);
    console.log(`devices表当前有 ${devicesIndexes.length} 个索引`);

    // 保留PRIMARY和第一个device_id索引，删除其他重复的device_id索引
    const indexesToKeep = ['PRIMARY', 'device_id'];
    const indexesToDrop = [];

    devicesIndexes.forEach(index => {
      const keyName = index.Key_name;
      if (!indexesToKeep.includes(keyName)) {
        indexesToDrop.push(keyName);
      }
    });

    console.log(`将保留索引: ${indexesToKeep.join(', ')}`);
    console.log(`将删除索引: ${indexesToDrop.length} 个`);

    // 执行删除操作
    for (const indexName of indexesToDrop) {
      console.log(`正在删除索引: ${indexName}`);
      await sequelize.query(`ALTER TABLE devices DROP INDEX ${indexName}`);
    }

    // 查询calendars表的索引
    const [calendarsIndexes] = await sequelize.query(`SHOW INDEXES FROM calendars`);
    console.log(`\ncalendars表当前有 ${calendarsIndexes.length} 个索引`);

    // 整理calendars表索引
    const calendarIndexMap = {};
    calendarsIndexes.forEach(index => {
      const keyName = index.Key_name;
      const columnName = index.Column_name;
      
      if (!calendarIndexMap[columnName]) {
        calendarIndexMap[columnName] = [];
      }
      calendarIndexMap[columnName].push(keyName);
    });

    // 对于每个列，只保留一个索引
    const calendarIndexesToDrop = [];
    for (const column in calendarIndexMap) {
      const indexes = calendarIndexMap[column];
      if (indexes.length > 1) {
        // 保留第一个索引，删除其余的
        calendarIndexesToDrop.push(...indexes.slice(1));
      }
    }

    console.log(`将删除calendars表索引: ${calendarIndexesToDrop.length} 个`);

    // 执行删除操作
    for (const indexName of calendarIndexesToDrop) {
      if (indexName !== 'PRIMARY') {
        console.log(`正在删除calendars表索引: ${indexName}`);
        await sequelize.query(`ALTER TABLE calendars DROP INDEX ${indexName}`);
      }
    }

    console.log('\n索引清理完成，现在检查索引数量:');
    
    // 再次查询索引数量
    const [devicesIndexesAfter] = await sequelize.query(`SHOW INDEXES FROM devices`);
    console.log(`devices表现在有 ${devicesIndexesAfter.length} 个索引`);
    
    const [calendarsIndexesAfter] = await sequelize.query(`SHOW INDEXES FROM calendars`);
    console.log(`calendars表现在有 ${calendarsIndexesAfter.length} 个索引`);

    // 关闭连接
    await sequelize.close();
    
    console.log('\n修复完成！请重新启动应用程序。');
  } catch (error) {
    console.error('修复失败:', error);
  }
}

// 执行函数
fixIndexes(); 