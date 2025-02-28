const express = require('express');
const {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  batchSchedules
} = require('../controllers/scheduleController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true });

// 所有路由都需要身份验证
router.use(protect);

// 批量操作路由
router.post('/batch', batchSchedules);

// 基本CRUD路由
router.route('/')
  .post(createSchedule)
  .get(getSchedules);

router.route('/:id')
  .get(getScheduleById)
  .put(updateSchedule)
  .delete(deleteSchedule);

module.exports = router; 