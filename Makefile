.PHONY: help dev build test clean docker-build docker-up docker-down

# 默认目标
help:
	@echo "工程效能 AI 助手 - 开发命令"
	@echo ""
	@echo "开发命令:"
	@echo "  dev          启动开发环境"
	@echo "  dev-backend  启动后端开发服务器"
	@echo "  dev-frontend 启动前端开发服务器"
	@echo ""
	@echo "构建命令:"
	@echo "  build        构建所有服务"
	@echo "  build-backend 构建后端"
	@echo "  build-frontend 构建前端"
	@echo ""
	@echo "测试命令:"
	@echo "  test         运行所有测试"
	@echo "  test-backend 运行后端测试"
	@echo "  test-frontend 运行前端测试"
	@echo ""
	@echo "Docker命令:"
	@echo "  docker-build 构建Docker镜像"
	@echo "  docker-up    启动Docker容器"
	@echo "  docker-down  停止Docker容器"
	@echo ""
	@echo "其他命令:"
	@echo "  clean        清理构建文件"
	@echo "  deps         安装依赖"

# 开发环境
dev: docker-up
	@echo "开发环境启动完成"
	@echo "前端: http://localhost:3000"
	@echo "后端: http://localhost:8080"
	@echo "数据库: localhost:5432"

dev-backend:
	@echo "启动后端开发服务器..."
	cd . && go run cmd/server/main.go

dev-frontend:
	@echo "启动前端开发服务器..."
	cd frontend && yarn dev

# 构建
build: build-backend build-frontend
	@echo "构建完成"

build-backend:
	@echo "构建后端..."
	CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bin/server cmd/server/main.go

build-frontend:
	@echo "构建前端..."
	cd frontend && yarn build

# 测试
test: test-backend test-frontend
	@echo "所有测试完成"

test-backend:
	@echo "运行后端测试..."
	go test -v ./...

test-frontend:
	@echo "运行前端测试..."
	cd frontend && yarn test

# 依赖管理
deps:
	@echo "安装后端依赖..."
	go mod download
	@echo "安装前端依赖..."
	cd frontend && yarn install

# Docker操作
docker-build:
	@echo "构建Docker镜像..."
	docker-compose build

docker-up:
	@echo "启动Docker容器..."
	docker-compose up -d
	@echo "等待服务启动..."
	sleep 10
	@echo "检查服务状态..."
	docker-compose ps

docker-down:
	@echo "停止Docker容器..."
	docker-compose down

docker-logs:
	@echo "查看服务日志..."
	docker-compose logs -f

# 数据库操作
db-migrate:
	@echo "运行数据库迁移..."
	go run cmd/migrate/main.go

db-seed:
	@echo "初始化测试数据..."
	go run cmd/seed/main.go

db-reset: docker-down
	@echo "重置数据库..."
	docker volume rm cdnagent_postgres_data cdnagent_redis_data || true
	$(MAKE) docker-up

# 清理
clean:
	@echo "清理构建文件..."
	rm -rf bin/
	rm -rf frontend/dist/
	rm -rf frontend/node_modules/.cache/
	go clean -cache

# 代码格式化和检查
fmt:
	@echo "格式化Go代码..."
	go fmt ./...
	@echo "格式化前端代码..."
	cd frontend && yarn prettier --write .

lint:
	@echo "检查Go代码..."
	golangci-lint run ./...
	@echo "检查前端代码..."
	cd frontend && yarn lint

# 生产部署
deploy:
	@echo "部署到生产环境..."
	$(MAKE) build
	$(MAKE) docker-build
	docker-compose -f docker-compose.prod.yml up -d

# 监控和日志
logs:
	@echo "查看应用日志..."
	tail -f logs/*.log

monitor:
	@echo "监控服务状态..."
	watch -n 2 'docker-compose ps && echo "" && docker stats --no-stream'
