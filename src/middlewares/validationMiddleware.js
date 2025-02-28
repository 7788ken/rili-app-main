const { body, validationResult } = require('express-validator');

// 处理验证结果
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '请求数据验证失败',
      errors: errors.array(),
    });
  }
  next();
};

// 用户注册验证规则
const userRegisterValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('用户名长度必须在3到30个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('请提供有效的电子邮件地址')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少为6个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个小写字母、一个大写字母和一个数字'),
  
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('全名长度必须在2到50个字符之间'),
    
  handleValidationErrors,
];

// 用户登录验证规则
const userLoginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('请提供有效的电子邮件地址')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('密码不能为空'),
    
  handleValidationErrors,
];

// 密码重置请求验证规则
const passwordResetRequestValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('请提供有效的电子邮件地址')
    .normalizeEmail(),
    
  handleValidationErrors,
];

// 密码重置验证规则
const passwordResetValidation = [
  body('token')
    .notEmpty()
    .withMessage('令牌不能为空'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少为6个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个小写字母、一个大写字母和一个数字'),
    
  handleValidationErrors,
];

// 日历创建验证规则
const calendarValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('日历标题不能为空')
    .isLength({ max: 100 })
    .withMessage('日历标题最多100个字符'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('日历描述最多500个字符'),
  
  body('color')
    .optional()
    .isHexColor()
    .withMessage('颜色必须是有效的十六进制颜色代码'),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic必须是布尔值'),
    
  handleValidationErrors,
];

// 日程创建验证规则
const scheduleValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('日程标题不能为空')
    .isLength({ max: 200 })
    .withMessage('日程标题最多200个字符'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('日程描述最多1000个字符'),
  
  body('startDate')
    .notEmpty()
    .withMessage('开始日期不能为空')
    .isISO8601()
    .withMessage('开始日期必须是有效的ISO8601日期格式'),
  
  body('endDate')
    .notEmpty()
    .withMessage('结束日期不能为空')
    .isISO8601()
    .withMessage('结束日期必须是有效的ISO8601日期格式'),
  
  body('calendar')
    .notEmpty()
    .withMessage('日历ID不能为空')
    .isMongoId()
    .withMessage('日历ID必须是有效的MongoDB ID'),
    
  handleValidationErrors,
];

// 分享码验证规则
const shareCodeValidation = [
  body('shareCode')
    .notEmpty()
    .withMessage('分享码不能为空')
    .isLength({ min: 6 })
    .withMessage('无效的分享码'),
    
  handleValidationErrors,
];

module.exports = {
  userRegisterValidation,
  userLoginValidation,
  passwordResetRequestValidation,
  passwordResetValidation,
  calendarValidation,
  scheduleValidation,
  shareCodeValidation,
  handleValidationErrors,
}; 