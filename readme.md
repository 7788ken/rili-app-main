# 日历共享服务后端

一个基于Node.js的轻量级日历共享服务，允许用户通过唯一分享码分享和协作管理日历，无需注册账号。

## 功能特性

- **无需注册账号**：通过唯一分享码直接访问和编辑日历
- **日历共享**：生成分享码，支持多人协作查看和编辑
- **日程管理**：创建、更新、删除日程，支持任务完成状态标记
- **实时同步**：支持多设备实时数据同步
- **离线支持**：提供批量同步API，处理离线编辑的日历数据
- **临时访问控制**：支持只读/可编辑模式，可添加简单的编辑密码保护

## 技术栈

- **后端框架**: Express.js
- **数据库**: MySQL (使用Sequelize ORM)
- **实时通信**: Socket.IO
- **API文档**: OpenAPI/Swagger (可选)

## API接口说明 (更新版)

系统基于设备ID识别而非用户登录，所有API都需要设备唯一标识符。

### 分享和同步 API

#### 分享本地日历到云端
- **请求**: `POST /api/share`
- **功能**: 将本地日历上传至云端并生成分享码
- **请求体**:
```json
{
  "deviceId": "设备唯一标识符",
  "deviceName": "设备名称", 
  "platform": "设备平台",
  "calendar": {
    "title": "日历标题",
    "description": "日历描述",
    "color": "颜色（十六进制）"
  },
  "schedules": [
    {
      "localId": "本地日程ID",
      "title": "日程标题",
      "description": "日程描述",
      "startTime": "开始时间",
      "endTime": "结束时间",
      "isAllDay": false, 
      "location": "地点",
      "color": "颜色",
      "isCompleted": true或false
    }
  ],
  "editPassword": "可选的编辑密码"
}
```
- **响应**: 
```json
{
  "success": true,
  "message": "日历已成功分享",
  "data": {
    "calendar": {
      "id": 1,
      "title": "日历标题",
      "shareCode": "12位分享码",
      "shareExpire": "过期时间"
    },
    "shareUrl": "分享链接"
  }
}
```

#### 获取分享日历信息
- **请求**: `GET /api/share/:shareCode`
- **功能**: 获取通过分享码共享的日历和日程信息
- **响应**:
```json
{
  "success": true,
  "data": {
    "calendar": {
      "id": 1,
      "title": "日历标题",
      "description": "日历描述",
      "color": "颜色代码",
      "shareCode": "分享码",
      "shareExpire": "过期时间",
      "requiresPassword": false
    },
    "schedules": [
      {
        "id": 1,
        "localId": "本地ID",
        "title": "日程标题",
        "description": "描述",
        "startTime": "开始时间",
        "endTime": "结束时间",
        "isAllDay": false,
        "location": "地点",
        "isCompleted": true或false
      }
    ]
  }
}
```

#### 导入分享日历
- **请求**: `POST /api/share/:shareCode/import`
- **功能**: 导入共享日历到本地设备
- **请求体**:
```json
{
  "deviceId": "设备唯一标识符",
  "deviceName": "设备名称",
  "platform": "设备平台"
}
```
- **响应**: 返回日历和日程的完整信息，便于导入到本地

#### 同步更新分享日历
- **请求**: `POST /api/share/:shareCode/sync`
- **功能**: 将本地修改同步到云端共享日历
- **请求体**:
```json
{
  "deviceId": "设备唯一标识符",
  "deviceName": "设备名称",
  "platform": "设备平台",
  "password": "如果日历设置了密码则需提供",
  "title": "可选，更新日历标题",
  "description": "可选，更新日历描述",
  "color": "可选，更新日历颜色",
  "schedules": [
    {
      "localId": "本地日程ID",
      "title": "日程标题",
      "description": "日程描述",
      "startTime": "开始时间",
      "endTime": "结束时间",
      "isAllDay": false,
      "location": "地点",
      "syncStatus": "synced/new/updated/deleted",
      "isCompleted": true或false
    }
  ]
}
```
- **响应**:
```json
{
  "success": true,
  "message": "日历同步成功",
  "data": {
    "calendar": {
      "id": 1,
      "title": "日历标题",
      "lastSync": "同步时间"
    },
    "syncResult": {
      "added": 1,
      "updated": 2,
      "deleted": 0,
      "skipped": 0
    }
  }
}
```

### 前端页面

- `GET /calendar/:shareCode` - 提供一个基于HTML的日历导入页面，用户可通过此页面查看和导入分享的日历

### WebSocket事件 (Socket.IO)

用于实时同步多设备间的日历更改:

- `join-calendar`: 加入日历房间
- `leave-calendar`: 离开日历房间
- `calendar-change`: 发送日历变更通知
- `calendar-updated`: 接收日历更新

## 任务完成状态标记 (isCompleted)

- 所有日程对象都包含 `isCompleted` 字段，值为布尔类型（`true` 或 `false`）
- 用于标记任务是否已完成
- 在共享日历中，所有设备都可以更新任务完成状态
- 客户端应通过UI元素（如复选框）允许用户标记任务完成状态

## 多设备同步策略

- **设备ID标识**: 每个设备生成唯一ID并保存在本地存储中，用于识别设备
- **同步状态保留**: 系统保留各设备的同步状态，不会在单个设备更新时覆盖其他设备的状态
- **冲突解决**: 后端接收所有设备的更新，处理可能的冲突

## 环境要求

- Node.js >= 14.x
- MySQL >= 5.x
- npm >= 6.x

## 安装步骤

1. 克隆仓库
```bash
git clone <仓库地址>
cd <仓库目录>
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
创建 `.env` 文件，填入以下内容：
```
PORT=3000
DB_HOST=localhost
DB_USER=你的数据库用户名
DB_PASS=你的数据库密码
DB_NAME=calendar_share_db
NODE_ENV=development
```

4. 创建数据库
确保MySQL已安装并运行在您的系统上，然后创建数据库：
```sql
CREATE DATABASE calendar_share_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. 启动开发服务器
```bash
npm run dev
```

6. 生产环境启动
```bash
npm start
```

## 安全说明

- 分享码使用足够长且随机的字符串（12字符）
- 提供简单的访问密码选项，用于编辑保护
- 实现了请求频率限制，防止滥用和暴力破解
- 数据会在一定时间后自动过期清理（默认30天未访问）

## 客户端集成指南

### Flutter客户端集成

```dart
// 生成设备ID
String getDeviceId() {
  final deviceId = prefs.getString('calendar_device_id');
  if (deviceId == null) {
    final newDeviceId = 'device_${uuid.v4()}';
    prefs.setString('calendar_device_id', newDeviceId);
    return newDeviceId;
  }
  return deviceId;
}

// 分享日历
Future<String> shareCalendar(Calendar calendar, List<Schedule> schedules) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/api/share'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'deviceId': getDeviceId(),
      'deviceName': await getDeviceName(),
      'platform': 'Flutter',
      'calendar': calendar.toJson(),
      'schedules': schedules.map((s) => s.toJson()).toList(),
    }),
  );
  
  final data = jsonDecode(response.body);
  return data['data']['calendar']['shareCode'];
}

// 导入日历
Future<CalendarWithSchedules> importCalendar(String shareCode) async {
  final response = await http.post(
    Uri.parse('$apiBaseUrl/api/share/$shareCode/import'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'deviceId': getDeviceId(),
      'deviceName': await getDeviceName(),
      'platform': 'Flutter',
    }),
  );
  
  final data = jsonDecode(response.body);
  return CalendarWithSchedules.fromJson(data['data']);
}
```

## 许可证

MIT

## 常见问题

### MongoDB连接错误

如果遇到 `MongoDB连接错误: connect ECONNREFUSED 127.0.0.1:27017` 错误，请检查：

1. MongoDB服务是否已启动
2. 防火墙是否阻止了MongoDB连接
3. MongoDB是否配置为允许远程连接
4. 端口是否被其他应用占用

### 使用MongoDB Atlas

如果希望使用MongoDB Atlas云服务代替本地MongoDB，请修改`.env`文件中的`MONGODB_URI`：

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database>
```

替换`<username>`、`<password>`、`<cluster-url>`和`<database>`为您的Atlas账户信息。

## 项目调整说明

根据需求变更，项目已从基于用户认证的日历系统调整为无需用户认证的分享码日历系统：

### 主要调整内容

1. **移除用户认证**：删除了用户注册、登录、权限控制相关代码
2. **基于分享码的访问**：实现了通过唯一分享码访问和修改日历的机制
3. **简化日历模型**：调整日历和日程模型，移除与用户关联的字段
4. **增加安全措施**：
   - 添加请求频率限制防止滥用
   - 实现过期清理机制，自动删除长期未访问的日历
   - 支持简单密码保护机制
5. **离线同步**：实现批量同步API，支持离线-在线场景的数据同步
6. **实时协作**：通过Socket.IO支持实时日历更新通知

### API结构

新的API结构更加简洁，主要围绕分享码进行操作：

- `POST /api/calendars/share` - 创建共享日历并获取分享码
- `GET /api/calendars/:shareCode` - 获取日历信息
- `PUT /api/calendars/:shareCode` - 更新日历信息
- `GET|POST|PUT|DELETE /api/calendars/:shareCode/schedules/*` - 管理日程
- `POST /api/calendars/:shareCode/sync` - 批量同步日程变更

### 下一步计划

1. **完善测试**：为核心API编写单元测试和集成测试
2. **性能优化**：实现数据缓存和查询优化
3. **扩展功能**：根据需求添加更多日历特性（标签、分类等）
4. **文档完善**：提供更详细的API文档和示例


