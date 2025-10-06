package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/liusCraft/orion/internal/api"
	"github.com/liusCraft/orion/internal/config"
	"github.com/liusCraft/orion/internal/database"
	"github.com/liusCraft/orion/internal/pkg/logger"
)

// @title AI Assistant API
// @version 1.0
// @description Engineering Productivity AI Assistant RESTful API
// @termsOfService https://example.com/terms/

// @contact.name API Support
// @contact.url https://example.com/support
// @contact.email support@example.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api/v1

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// 加载配置
	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 初始化日志
	logger.Init(config.GlobalConfig.Server.Mode)

	// 初始化数据库
	db, err := database.Init(&config.GlobalConfig.Database)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 运行数据库迁移
	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

	// 初始化API服务器
	server, err := api.NewServer(db)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// 启动HTTP服务器
	httpServer := &http.Server{
		Addr:         fmt.Sprintf("%s:%s", config.GlobalConfig.Server.Host, config.GlobalConfig.Server.Port),
		Handler:      server.Router(),
		ReadTimeout:  time.Duration(config.GlobalConfig.Server.ReadTimeout) * time.Second,
		WriteTimeout: time.Duration(config.GlobalConfig.Server.WriteTimeout) * time.Second,
	}

	// 在goroutine中启动服务器
	go func() {
		logger.Info("Starting HTTP server on %s", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待中断信号优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// 创建超时上下文用于优雅关闭
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 关闭HTTP服务器
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// 关闭数据库连接
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.Close()
	}

	logger.Info("Server exited")
}
