/**
 * 数据库重置脚本 - 用于完全重建数据库结构
 */
const { sequelize } = require('../models/index');

const resetDatabase = async () => {
  try {
    console.log('正在重置数据库...');
    
    // 禁用外键约束检查
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // 强制重建所有表（危险操作！仅在开发环境使用）
    await sequelize.sync({ force: true });
    
    // 重新启用外键约束检查
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('数据库已成功重置！');
    process.exit(0);
  } catch (error) {
    console.error('数据库重置失败:', error);
    process.exit(1);
  }
};

resetDatabase(); 