# API接口设计文档

## 文档信息
- **创建日期**: 2025-09-29
- **API版本**: v1
- **Base URL**: `https://api.cdnagent.com/api/v1`
- **认证方式**: JWT Bearer Token

## 1. 通用规范

### 1.1 请求格式
- **Content-Type**: `application/json`
- **字符编码**: UTF-8
- **时间格式**: ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)

### 1.2 统一响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": "2025-09-29T10:30:00Z",
  "requestId": "uuid"
}
```

### 1.3 HTTP状态码
- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未认证
- `403` - 权限不足
- `404` - 资源不存在
- `429` - 请求过于频繁
- `500` - 服务器内部错误

### 1.4 错误码定义
```json
{
  "code": 40001,
  "message": "用户名或密码错误",
  "data": null,
  "timestamp": "2025-09-29T10:30:00Z",
  "requestId": "uuid"
}
```

#### 错误码范围
- `1xxxx` - 系统级错误
- `2xxxx` - 认证相关错误
- `3xxxx` - 业务逻辑错误
- `4xxxx` - 参数验证错误
- `5xxxx` - 外部服务错误

## 2. 认证授权模块

### 2.1 用户登录
```http
POST /auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123",
  "remember": true
}
```

**响应**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600,
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "email": "john@example.com",
      "displayName": "John Doe",
      "role": "user",
      "department": "运维",
      "avatar": "https://..."
    }
  }
}
```

### 2.2 刷新Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 2.3 用户注销
```http
POST /auth/logout
Authorization: Bearer {accessToken}
```

### 2.4 获取当前用户信息
```http
GET /auth/me
Authorization: Bearer {accessToken}
```

### 2.5 修改密码
```http
PUT /auth/password
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "oldPassword": "old123",
  "newPassword": "new456"
}
```

## 3. 对话系统模块

### 3.1 获取对话列表
```http
GET /conversations?page=1&size=20&status=active
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "uuid",
        "title": "CDN配置问题",
        "lastMessage": "最后一条消息内容...",
        "lastMessageAt": "2025-09-29T10:30:00Z",
        "totalMessages": 15,
        "status": "active",
        "createdAt": "2025-09-29T09:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "size": 20,
    "totalPages": 5
  }
}
```

### 3.2 创建新对话
```http
POST /conversations
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "新对话标题(可选)",
  "firstMessage": "第一条消息内容"
}
```

### 3.3 获取对话详情
```http
GET /conversations/{conversationId}
Authorization: Bearer {accessToken}
```

### 3.4 获取对话消息
```http
GET /conversations/{conversationId}/messages?page=1&size=50
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "uuid",
        "conversationId": "uuid",
        "parentMessageId": "uuid",
        "senderType": "user",
        "content": "消息内容",
        "contentType": "text",
        "metadata": {
          "toolResults": [],
          "references": []
        },
        "status": "completed",
        "createdAt": "2025-09-29T10:30:00Z"
      }
    ],
    "total": 50,
    "hasMore": true
  }
}
```

### 3.5 发送消息 (非流式)
```http
POST /conversations/{conversationId}/messages
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "content": "用户输入的消息内容",
  "parentMessageId": "uuid(可选)",
  "attachments": [
    {
      "fileName": "file.pdf",
      "fileSize": 1024000,
      "mimeType": "application/pdf",
      "base64Data": "base64编码的文件内容"
    }
  ]
}
```

### 3.6 流式对话 (SSE)
```http
POST /conversations/{conversationId}/messages/stream
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "content": "用户输入的消息内容",
  "parentMessageId": "uuid(可选)"
}
```

**SSE响应格式**:
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: message_start
data: {"messageId": "uuid", "conversationId": "uuid", "timestamp": "2025-09-29T10:30:00Z"}

event: content_delta
data: {"messageId": "uuid", "delta": "这是"}

event: content_delta  
data: {"messageId": "uuid", "delta": "流式"}

event: content_delta
data: {"messageId": "uuid", "delta": "响应"}

event: tool_call_start
data: {"messageId": "uuid", "toolName": "grafana_query", "toolId": "uuid"}

event: tool_call_result
data: {"messageId": "uuid", "toolId": "uuid", "result": {"status": "success", "data": {...}}}

event: content_delta
data: {"messageId": "uuid", "delta": "根据监控数据显示..."}

event: message_complete
data: {"messageId": "uuid", "finalContent": "完整消息内容", "metadata": {"tokenCount": 150, "processingTime": 2500, "toolCalls": [...]}}

event: error
data: {"code": 30001, "message": "AI服务暂时不可用", "messageId": "uuid"}

event: done
data: {}
```

### 3.7 删除对话
```http
DELETE /conversations/{conversationId}
Authorization: Bearer {accessToken}
```

### 3.8 更新对话标题
```http
PUT /conversations/{conversationId}/title
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "新的对话标题"
}
```

## 4. 知识库模块

### 4.1 获取知识分类
```http
GET /knowledge/categories
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "uuid",
      "name": "CDN基础",
      "description": "CDN基础概念和原理",
      "parentId": null,
      "children": [
        {
          "id": "uuid",
          "name": "缓存机制",
          "description": "CDN缓存工作原理",
          "parentId": "parent_uuid",
          "children": []
        }
      ],
      "documentCount": 25,
      "status": "active"
    }
  ]
}
```

### 4.2 获取知识文档列表
```http
GET /knowledge/documents?categoryId=uuid&page=1&size=20&status=published&search=关键词
Authorization: Bearer {accessToken}
```

### 4.3 获取知识文档详情
```http
GET /knowledge/documents/{documentId}
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": "uuid",
    "title": "CDN缓存配置指南",
    "content": "# CDN缓存配置指南\n\n...",
    "contentType": "markdown",
    "summary": "本文档介绍了CDN缓存的配置方法...",
    "tags": ["CDN", "缓存", "配置"],
    "category": {
      "id": "uuid",
      "name": "配置管理"
    },
    "author": {
      "id": "uuid",
      "displayName": "张三"
    },
    "version": 3,
    "status": "published",
    "viewCount": 1250,
    "likeCount": 35,
    "createdAt": "2025-09-29T10:30:00Z",
    "updatedAt": "2025-09-29T15:20:00Z"
  }
}
```

### 4.4 创建知识文档
```http
POST /knowledge/documents
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "新文档标题",
  "content": "文档内容",
  "contentType": "markdown",
  "summary": "文档摘要",
  "categoryId": "uuid",
  "tags": ["标签1", "标签2"],
  "status": "draft"
}
```

### 4.5 更新知识文档
```http
PUT /knowledge/documents/{documentId}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "title": "更新后的标题",
  "content": "更新后的内容",
  "changeSummary": "更新说明"
}
```

### 4.6 删除知识文档
```http
DELETE /knowledge/documents/{documentId}
Authorization: Bearer {accessToken}
```

### 4.7 搜索知识文档
```http
POST /knowledge/documents/search
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "query": "搜索关键词",
  "categories": ["uuid1", "uuid2"],
  "tags": ["标签1"],
  "searchType": "hybrid", // text, vector, hybrid
  "limit": 10
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "results": [
      {
        "document": {
          "id": "uuid",
          "title": "文档标题",
          "summary": "文档摘要"
        },
        "relevantChunks": [
          {
            "content": "相关片段内容...",
            "score": 0.85,
            "chunkIndex": 3
          }
        ],
        "totalScore": 0.82
      }
    ],
    "total": 25,
    "searchTime": 150
  }
}
```

## 5. 工具系统模块

### 5.1 获取工具列表
```http
GET /tools?enabled=true&type=api
Authorization: Bearer {accessToken}
```

**响应**:
```json
{
  "code": 200,
  "data": [
    {
      "id": "uuid",
      "name": "grafana_query",
      "displayName": "Grafana监控查询",
      "description": "查询Grafana监控数据",
      "toolType": "api",
      "enabled": true,
      "config": {
        "baseUrl": "https://grafana.example.com",
        "endpoints": [
          {
            "name": "query_metrics",
            "method": "GET",
            "path": "/api/datasources/proxy/{datasourceId}/api/v1/query"
          }
        ]
      },
      "parameters": [
        {
          "name": "query",
          "type": "string",
          "required": true,
          "description": "PromQL查询语句"
        }
      ]
    }
  ]
}
```

### 5.2 获取工具详情
```http
GET /tools/{toolId}
Authorization: Bearer {accessToken}
```

### 5.3 执行工具
```http
POST /tools/{toolId}/execute
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "parameters": {
    "query": "up{job='prometheus'}",
    "start": "2025-09-29T10:00:00Z",
    "end": "2025-09-29T11:00:00Z"
  },
  "messageId": "uuid" // 关联的消息ID
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "executionId": "uuid",
    "status": "success",
    "result": {
      "data": {
        "resultType": "matrix",
        "result": []
      }
    },
    "executionTime": 1500,
    "timestamp": "2025-09-29T10:30:00Z"
  }
}
```

### 5.4 获取工具执行历史
```http
GET /tools/{toolId}/executions?page=1&size=20
Authorization: Bearer {accessToken}
```

### 5.5 创建工具配置 (管理员)
```http
POST /tools
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "new_tool",
  "displayName": "新工具",
  "description": "工具描述",
  "toolType": "api",
  "config": {
    "baseUrl": "https://api.example.com",
    "timeout": 30000
  },
  "authConfig": {
    "type": "bearer",
    "token": "encrypted_token"
  }
}
```

## 6. 系统管理模块

### 6.1 获取系统配置 (管理员)
```http
GET /admin/configs?type=llm
Authorization: Bearer {accessToken}
```

### 6.2 更新系统配置 (管理员)
```http
PUT /admin/configs/{configKey}
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "value": {
    "temperature": 0.8,
    "maxTokens": 2000
  },
  "description": "LLM参数配置"
}
```

### 6.3 获取使用统计
```http
GET /admin/statistics?startDate=2025-09-01&endDate=2025-09-30&metrics=message_count,active_users
Authorization: Bearer {accessToken}
```

### 6.4 获取审计日志 (管理员)
```http
GET /admin/audit-logs?page=1&size=50&action=delete&userId=uuid
Authorization: Bearer {accessToken}
```

## 7. 中间件和拦截器

### 7.1 认证中间件
```go
// JWT Token验证
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := extractToken(c)
        if token == "" {
            c.JSON(401, ErrorResponse{Code: 20001, Message: "缺少认证token"})
            c.Abort()
            return
        }
        
        user, err := validateToken(token)
        if err != nil {
            c.JSON(401, ErrorResponse{Code: 20002, Message: "token无效"})
            c.Abort()
            return
        }
        
        c.Set("user", user)
        c.Next()
    }
}
```

### 7.2 权限验证中间件
```go
func RequireRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        user := getCurrentUser(c)
        if !hasRole(user.Role, roles) {
            c.JSON(403, ErrorResponse{Code: 20003, Message: "权限不足"})
            c.Abort()
            return
        }
        c.Next()
    }
}
```

### 7.3 限流中间件
```go
func RateLimitMiddleware() gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Every(time.Second), 10) // 每秒10个请求
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.JSON(429, ErrorResponse{Code: 10001, Message: "请求过于频繁"})
            c.Abort()
            return
        }
        c.Next()
    }
}
```

## 8. SSE流式响应实现

### 8.1 Go实现示例
```go
func StreamChatHandler(c *gin.Context) {
    // 设置SSE响应头
    c.Header("Content-Type", "text/event-stream")
    c.Header("Cache-Control", "no-cache")
    c.Header("Connection", "keep-alive")
    c.Header("Access-Control-Allow-Origin", "*")
    c.Header("Access-Control-Allow-Headers", "Cache-Control")

    // 获取用户输入
    var req ChatRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        sendSSEError(c, 40001, "请求参数错误")
        return
    }

    // 创建消息记录
    messageID := uuid.New().String()
    
    // 发送开始事件
    sendSSEEvent(c, "message_start", map[string]interface{}{
        "messageId": messageID,
        "conversationId": req.ConversationID,
        "timestamp": time.Now().UTC().Format(time.RFC3339),
    })

    // 调用AI服务进行流式处理
    err := processAIStream(c, messageID, req.Content)
    if err != nil {
        sendSSEError(c, 30001, "AI服务处理失败")
        return
    }

    // 发送完成事件
    sendSSEEvent(c, "done", map[string]interface{}{})
}

func sendSSEEvent(c *gin.Context, event string, data interface{}) {
    jsonData, _ := json.Marshal(data)
    fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", event, jsonData)
    c.Writer.Flush()
}

func sendSSEError(c *gin.Context, code int, message string) {
    errorData := map[string]interface{}{
        "code": code,
        "message": message,
    }
    sendSSEEvent(c, "error", errorData)
}
```

### 8.2 前端JavaScript实现
```javascript
function startStreamChat(conversationId, content) {
    const eventSource = new EventSource(`/api/v1/conversations/${conversationId}/messages/stream`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    let currentMessage = '';
    let messageId = '';

    eventSource.addEventListener('message_start', (event) => {
        const data = JSON.parse(event.data);
        messageId = data.messageId;
        currentMessage = '';
        // 在UI中创建新的消息容器
        createMessageContainer(messageId);
    });

    eventSource.addEventListener('content_delta', (event) => {
        const data = JSON.parse(event.data);
        currentMessage += data.delta;
        // 更新UI中的消息内容
        updateMessageContent(messageId, currentMessage);
    });

    eventSource.addEventListener('tool_call_start', (event) => {
        const data = JSON.parse(event.data);
        // 显示工具调用状态
        showToolCallStatus(messageId, data.toolName);
    });

    eventSource.addEventListener('tool_call_result', (event) => {
        const data = JSON.parse(event.data);
        // 显示工具调用结果
        showToolCallResult(messageId, data.result);
    });

    eventSource.addEventListener('message_complete', (event) => {
        const data = JSON.parse(event.data);
        // 消息完成，显示最终状态
        finalizeMessage(messageId, data);
    });

    eventSource.addEventListener('error', (event) => {
        const data = JSON.parse(event.data);
        // 显示错误信息
        showError(data.message);
        eventSource.close();
    });

    eventSource.addEventListener('done', (event) => {
        // 流式响应结束
        eventSource.close();
    });

    eventSource.onerror = (error) => {
        console.error('SSE连接错误:', error);
        eventSource.close();
    };

    return eventSource;
}
```

## 9. 路由设计

### 9.1 路由分组
```go
func SetupRoutes(r *gin.Engine) {
    api := r.Group("/api/v1")
    
    // 认证相关
    auth := api.Group("/auth")
    {
        auth.POST("/login", LoginHandler)
        auth.POST("/refresh", RefreshTokenHandler)
        auth.POST("/logout", AuthMiddleware(), LogoutHandler)
        auth.GET("/me", AuthMiddleware(), GetCurrentUserHandler)
    }
    
    // 对话相关
    conversations := api.Group("/conversations")
    conversations.Use(AuthMiddleware())
    {
        conversations.GET("", GetConversationsHandler)
        conversations.POST("", CreateConversationHandler)
        conversations.GET("/:id", GetConversationHandler)
        conversations.DELETE("/:id", DeleteConversationHandler)
        conversations.GET("/:id/messages", GetMessagesHandler)
        conversations.POST("/:id/messages", SendMessageHandler)
        conversations.POST("/:id/messages/stream", StreamChatHandler) // SSE流式接口
    }
    
    // 知识库相关
    knowledge := api.Group("/knowledge")
    knowledge.Use(AuthMiddleware())
    {
        knowledge.GET("/categories", GetCategoriesHandler)
        knowledge.GET("/documents", GetDocumentsHandler)
        knowledge.POST("/documents", CreateDocumentHandler)
        knowledge.GET("/documents/:id", GetDocumentHandler)
        knowledge.PUT("/documents/:id", UpdateDocumentHandler)
        knowledge.DELETE("/documents/:id", DeleteDocumentHandler)
        knowledge.POST("/documents/search", SearchDocumentsHandler)
    }
    
    // 工具相关
    tools := api.Group("/tools")
    tools.Use(AuthMiddleware())
    {
        tools.GET("", GetToolsHandler)
        tools.GET("/:id", GetToolHandler)
        tools.POST("/:id/execute", ExecuteToolHandler)
        tools.GET("/:id/executions", GetToolExecutionsHandler)
    }
    
    // 管理员相关
    admin := api.Group("/admin")
    admin.Use(AuthMiddleware(), RequireRole("admin"))
    {
        admin.GET("/configs", GetConfigsHandler)
        admin.PUT("/configs/:key", UpdateConfigHandler)
        admin.GET("/statistics", GetStatisticsHandler)
        admin.GET("/audit-logs", GetAuditLogsHandler)
    }
}
```

## 10. 错误处理

### 10.1 统一错误响应
```go
type ErrorResponse struct {
    Code      int    `json:"code"`
    Message   string `json:"message"`
    Data      any    `json:"data"`
    Timestamp string `json:"timestamp"`
    RequestID string `json:"requestId"`
}

func HandleError(c *gin.Context, err error, code int, message string) {
    c.JSON(code, ErrorResponse{
        Code:      getErrorCode(err),
        Message:   message,
        Data:      nil,
        Timestamp: time.Now().UTC().Format(time.RFC3339),
        RequestID: getRequestID(c),
    })
}
```

### 10.2 业务异常定义
```go
var (
    ErrUserNotFound     = errors.New("用户不存在")
    ErrInvalidPassword  = errors.New("密码错误")
    ErrTokenExpired     = errors.New("token已过期")
    ErrPermissionDenied = errors.New("权限不足")
    ErrResourceNotFound = errors.New("资源不存在")
    ErrRateLimited      = errors.New("请求过于频繁")
)
```

---

**文档版本**: v1.0  
**最后更新**: 2025-09-29  
**维护人**: 后端团队