package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	// 创建Gin引擎
	r := gin.Default()

	// 健康检查端点
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Unix(),
			"version":   "1.0.0",
			"message":   "CDN AI Agent API is running",
		})
	})

	// API信息端点
	r.GET("/api/v1/info", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"name":        "CDN AI Agent",
			"version":     "1.0.0",
			"description": "智能CDN运维助手API",
		})
	})

	// 启动服务器
	r.Run(":8080")
}