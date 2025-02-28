/**
 * 成功响应处理
 * @param {Object} res - Express响应对象
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 响应消息
 * @param {*} data - 响应数据
 * @returns {Object} 格式化的响应
 */
const successResponse = (res, statusCode = 200, message = '操作成功', data = null) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * 错误响应处理
 * @param {Object} res - Express响应对象
 * @param {number} statusCode - HTTP状态码
 * @param {string} message - 错误消息
 * @param {Error} error - 错误对象
 * @returns {Object} 格式化的错误响应
 */
const errorResponse = (res, statusCode = 500, message = '服务器错误', error = null) => {
  const response = {
    success: false,
    message
  };

  // 在开发环境中包含错误详情
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error.message;
    response.stack = error.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse
}; 