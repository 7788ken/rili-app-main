1. 基本配置
基础URL: http://localhost:3000（已在前端代码中配置）
响应格式: 所有API响应应为JSON格式
错误处理: 使用标准HTTP状态码，错误响应包含message字段说明错误原因

2. 日历管理API
创建/分享日历
端点: POST /api/calendars/share
请求体:{
  "name": "日历名称",
  "color": "颜色十六进制值（不含#）",
  "schedules": [
    {
      "id": "日程ID",
      "title": "日程标题",
      "description": "日程描述",
      "startTime": 开始时间戳,
      "endTime": 结束时间戳,
      "isAllDay": 0或1,
      "location": "地点",
      "isCompleted": true或false
    }
  ]
}
响应:
{
  "success": true,
  "shareCode": "生成的分享码"
}

获取共享日历信息
端点: GET /api/calendars/:shareCode
响应:{
  "name": "日历名称",
  "color": "颜色十六进制值",
  "ownerId": "创建者ID",
  "createdAt": 创建时间戳
}

更新共享日历信息
端点: PUT /api/calendars/:shareCode
请求体:
{
  "name": "新的日历名称",
  "color": "新的颜色十六进制值"
}
响应: { "success": true }


3. 日程管理API
获取日历下所有日程
端点: GET /api/calendars/:shareCode/schedules
响应:{
  "schedules": [
    {
      "id": "日程ID",
      "title": "日程标题",
      "description": "日程描述",
      "startTime": 开始时间戳,
      "endTime": 结束时间戳,
      "isAllDay": 0或1,
      "location": "地点",
      "isCompleted": true或false
    }
  ]
}

添加日程
端点: POST /api/calendars/:shareCode/schedules
请求体: 日程对象（同上）
响应: 创建的日程对象（含ID）
更新日程
端点: PUT /api/calendars/:shareCode/schedules/:scheduleId
请求体: 更新的日程对象
响应: { "success": true }
删除日程
端点: DELETE /api/calendars/:shareCode/schedules/:scheduleId
响应: { "success": true }
4. 批量同步API
批量同步日程
端点: POST /api/calendars/:shareCode/sync
请求体:
{
  "changes": [
    {
      "id": "日程ID",
      "title": "日程标题",
      "description": "日程描述",
      "startTime": 开始时间戳,
      "endTime": 结束时间戳,
      "isAllDay": 0或1,
      "location": "地点",
      "isCompleted": true或false
    }
  ]
}
响应: { "success": true, "updatedCount": 更新的数量 }

5. 开发建议
使用Express.js框架: 快速搭建基于Node.js的API服务器
数据库存储: 建议使用MongoDB或MySQL存储日历和日程数据
分享码生成: 建议使用短UUID或自定义短码生成器
表结构设计:
calendars: 存储日历信息，包含分享码
schedules: 存储日程信息，关联到日历

