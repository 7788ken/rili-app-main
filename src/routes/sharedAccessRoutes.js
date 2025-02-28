/**
 * 共享访问路由
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../middlewares/authMiddleware');
const {
  shareCalendar,
  getSharedUsers,
  updateSharePermission,
  removeSharedAccess,
  accessByShareCode,
  generateShareCode
} = require('../controllers/sharedAccessController');

// 日历共享相关路由
router.route('/')
  .get(protect, getSharedUsers)
  .post(protect, shareCalendar);

router.route('/:userId')
  .put(protect, updateSharePermission)
  .delete(protect, removeSharedAccess);

// 分享码相关路由
router.post('/code', protect, generateShareCode);

// 注意：这个路由需要在app.js中单独注册，因为它的路径不同
// router.post('/access/:shareCode', protect, accessByShareCode);

module.exports = router; 