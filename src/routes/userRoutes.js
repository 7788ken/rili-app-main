const express = require('express');
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  resetPasswordRequest,
  resetPassword,
  checkAdmin
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// 公开路由
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/reset-password-request', resetPasswordRequest);
router.post('/reset-password', resetPassword);

// 需要身份验证的路由
router.use(protect);
router.route('/profile')
  .get(getUserProfile)
  .put(updateUserProfile);

router.get('/admin-check', checkAdmin);

module.exports = router;