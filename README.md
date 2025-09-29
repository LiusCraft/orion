# CDN AI Agent

## 项目简介
CDN AI Agent 是一个面向CDN运维、研发和技术支持人员的智能问答助手产品。

## 技术栈

### 后端
- Go 1.21 + Gin Web框架
- CloudWeGo Eino AI框架
- PostgreSQL + pgvector
- Redis
- JWT认证

### 前端
- React 18 + TypeScript
- Ant Design UI组件库
- React Query 数据管理
- Zustand 状态管理
- React Router 路由

## 快速开始

### 环境要求
- Node.js 20+
- Go 1.21+
- Docker & Docker Compose

### 开发环境启动

1. **克隆项目**
```bash
git clone <repository-url>
cd cdnagent
```

2. **启动开发环境**
```bash
make dev
```

这将启动：
- 前端开发服务器: http://localhost:3000
- 后端API服务器: http://localhost:8080
- PostgreSQL数据库: localhost:5432
- Redis缓存: localhost:6379

3. **默认登录账户**
- 用户名: `admin`
- 密码: `admin123`

### 单独启动服务

```bash
# 启动后端
make dev-backend

# 启动前端
make dev-frontend

# 启动数据库和Redis
docker-compose up -d postgres redis
```

### 构建部署

```bash
# 构建所有服务
make build

# 构建Docker镜像
make docker-build

# 生产环境部署
make deploy
```

## 项目结构

```
cdnagent/
├── cmd/                    # 应用入口
│   └── server/            # 服务器启动
├── internal/              # 内部代码
│   ├── api/              # API层
│   ├── config/           # 配置管理
│   ├── database/         # 数据库
│   └── pkg/              # 内部工具包
├── frontend/             # 前端应用
│   ├── src/
│   │   ├── components/   # React组件
│   │   ├── pages/        # 页面组件
│   │   ├── services/     # API服务
│   │   ├── store/        # 状态管理
│   │   └── types/        # TypeScript类型
│   └── public/           # 静态资源
├── docs/                 # 项目文档
├── scripts/              # 部署脚本
└── Makefile             # 构建脚本
```

## 开发指南

### 后端开发

1. **添加新的API接口**
   - 在 `internal/api/handlers/` 添加处理器
   - 在 `internal/api/routes/` 注册路由
   - 在 `internal/database/models/` 添加数据模型

2. **数据库迁移**
```bash
make db-migrate
```

3. **运行测试**
```bash
make test-backend
```

### 前端开发

1. **添加新页面**
   - 在 `frontend/src/pages/` 创建页面组件
   - 在 `frontend/src/App.tsx` 添加路由

2. **API集成**
   - 在 `frontend/src/services/` 添加API服务
   - 使用React Query处理数据获取

3. **状态管理**
   - 使用Zustand管理全局状态
   - 在 `frontend/src/store/` 创建store

## 可用命令

```bash
make help           # 查看所有可用命令
make dev            # 启动开发环境
make build          # 构建项目
make test           # 运行测试
make docker-up      # 启动Docker容器
make docker-down    # 停止Docker容器
make clean          # 清理构建文件
make fmt            # 格式化代码
make lint           # 代码检查
```

## API文档

启动开发环境后，API文档地址：
- Swagger UI: http://localhost:8080/swagger/index.html

## 数据库设计

详细数据库设计请参考：`docs/数据库设计文档.md`

## 部署说明

### Docker部署

```bash
# 构建镜像
make docker-build

# 启动服务
make docker-up
```

### 生产环境配置

1. 修改 `internal/config/config.json` 配置文件
2. 设置环境变量
3. 配置数据库连接
4. 配置Redis连接
5. 设置JWT密钥

## 故障排查

### 常见问题

1. **数据库连接失败**
   - 检查PostgreSQL是否启动
   - 验证连接配置

2. **前端无法访问API**
   - 检查后端服务是否启动
   - 验证CORS配置

3. **Docker启动失败**
   - 检查端口占用
   - 查看容器日志

### 查看日志

```bash
# 查看Docker日志
make docker-logs

# 查看应用日志
make logs
```

## 贡献指南

1. Fork项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License