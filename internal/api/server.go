package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/cdnagent/cdnagent/internal/api/handlers"
	"github.com/cdnagent/cdnagent/internal/api/middleware"
	"github.com/cdnagent/cdnagent/internal/api/routes"
	"github.com/cdnagent/cdnagent/internal/config"
)

type Server struct {
	db     *gorm.DB
	router *gin.Engine
}

func NewServer(db *gorm.DB) (*Server, error) {
	// 设置Gin模式
	gin.SetMode(config.GlobalConfig.Server.Mode)

	// 创建路由器
	router := gin.New()

	// 添加全局中间件
	router.Use(middleware.Logger())
	router.Use(middleware.Recovery())
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())

	// 创建服务器实例
	server := &Server{
		db:     db,
		router: router,
	}

	// 设置路由
	server.setupRoutes()

	return server, nil
}

func (s *Server) setupRoutes() {
	// 健康检查
	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "CDN AI Agent is running",
		})
	})

	// API路由组
	api := s.router.Group("/api/v1")

	// 初始化handlers
	authHandler := handlers.NewAuthHandler(s.db)
	chatHandler := handlers.NewChatHandler(s.db)
	knowledgeHandler := handlers.NewKnowledgeHandler(s.db)
	toolHandler := handlers.NewToolHandler(s.db)
	adminHandler := handlers.NewAdminHandler(s.db)

	// 设置路由
	routes.SetupAuthRoutes(api, authHandler)
	routes.SetupChatRoutes(api, chatHandler)
	routes.SetupKnowledgeRoutes(api, knowledgeHandler)
	routes.SetupToolRoutes(api, toolHandler)
	routes.SetupAdminRoutes(api, adminHandler)

	// Swagger文档
	// swaggerFiles := ginSwagger.WrapHandler(swaggerFiles.Handler)
	// s.router.GET("/swagger/*any", swaggerFiles)
}

func (s *Server) Router() *gin.Engine {
	return s.router
}