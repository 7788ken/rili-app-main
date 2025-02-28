/**
 * 分享路由 - 重构版：无需登录的日历分享功能
 */
const express = require('express');
const router = express.Router();
const {
  shareCalendar,
  getCalendarByShareCode,
  importSharedCalendar,
  syncSharedCalendar
} = require('../controllers/shareController');

// 创建分享日历 (上传本地日历到云端)
router.post('/', shareCalendar);

// 通过分享码获取日历和日程
router.get('/:shareCode', getCalendarByShareCode);

// 导入分享的日历到本地设备
router.post('/:shareCode/import', importSharedCalendar);

// 同步更新分享的日历
router.post('/:shareCode/sync', syncSharedCalendar);

module.exports = router; 