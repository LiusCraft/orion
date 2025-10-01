# 使用官方 Go 基础镜像
FROM golang:1.21-alpine AS builder

# 设置工作目录
WORKDIR /app

# 安装必要的系统包
RUN apk add --no-cache git ca-certificates

# 复制 go mod 和 go sum 文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/server/main.go

# 使用轻量级基础镜像
FROM alpine:latest

# 安装 ca-certificates 以支持 HTTPS
RUN apk --no-cache add ca-certificates

# 创建非特权用户
RUN addgroup -g 1001 -S cdnagent && adduser -u 1001 -S cdnagent -G cdnagent

# 设置工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/main .

# 复制配置文件
COPY --from=builder /app/config/config.json ./config/

# 更改文件所有权
RUN chown -R cdnagent:cdnagent /app

# 切换到非特权用户
USER cdnagent

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV GIN_MODE=release

# 启动应用
CMD ["./main"]
