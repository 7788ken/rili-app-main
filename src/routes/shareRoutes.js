/**
 * 日历分享路由
 */
const express = require('express');
const router = express.Router();
const { 
  shareCalendar, 
  getSharedCalendar, 
  importSharedCalendar, 
  syncSharedCalendar 
} = require('../controllers/shareController');

// 分享日历
router.post('/', shareCalendar);

// 获取分享的日历
router.get('/:shareCode', getSharedCalendar);

// 导入分享的日历到本地设备
router.post('/:shareCode/import', importSharedCalendar);

// 同步更新分享的日历
router.post('/:shareCode/sync', syncSharedCalendar);

module.exports = router; 