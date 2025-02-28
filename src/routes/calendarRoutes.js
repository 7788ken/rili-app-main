/**
 * 日历路由 - 重构版：无需登录的日历分享功能
 */
const express = require('express');
const { 
  shareCalendar,
  getCalendarByShareCode,
  updateCalendarByShareCode,
  getSchedulesByShareCode,
  addScheduleByShareCode,
  updateScheduleByShareCode,
  deleteScheduleByShareCode,
  syncSchedulesByShareCode
} = require('../controllers/calendarController');

const router = express.Router();

// POST /api/calendars/share - 创建/分享日历
router.post('/share', shareCalendar);

// GET /api/calendars/:shareCode - 获取共享日历信息
router.get('/:shareCode', getCalendarByShareCode);

// PUT /api/calendars/:shareCode - 更新共享日历信息
router.put('/:shareCode', updateCalendarByShareCode);

// 日程相关路由
// GET /api/calendars/:shareCode/schedules - 获取日历下所有日程
router.get('/:shareCode/schedules', getSchedulesByShareCode);

// POST /api/calendars/:shareCode/schedules - 添加日程
router.post('/:shareCode/schedules', addScheduleByShareCode);

// PUT /api/calendars/:shareCode/schedules/:scheduleId - 更新日程
router.put('/:shareCode/schedules/:scheduleId', updateScheduleByShareCode);

// DELETE /api/calendars/:shareCode/schedules/:scheduleId - 删除日程
router.delete('/:shareCode/schedules/:scheduleId', deleteScheduleByShareCode);

// POST /api/calendars/:shareCode/sync - 批量同步日程
router.post('/:shareCode/sync', syncSchedulesByShareCode);

module.exports = router; 