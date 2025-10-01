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
            "message":   "AI Assistant API is running",
		})
	})

	// API信息端点
	r.GET("/api/v1/info", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
            "name":        "AI 助手",
			"version":     "1.0.0",
            "description": "面向研发/运维/技术支持的工程效能 AI 助手 API",
		})
	})

	// 启动服务器
	r.Run(":8080")
}
