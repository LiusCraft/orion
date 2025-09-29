package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/cdnagent/cdnagent/internal/pkg/jwt"
	"github.com/cdnagent/cdnagent/internal/pkg/logger"
	"github.com/cdnagent/cdnagent/pkg/errors"
)

// Logger 日志中间件
func Logger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logger.Info("%s - [%s] \"%s %s %s %d %s \"%s\" %s\"",
			param.ClientIP,
			param.TimeStamp.Format(time.RFC1123),
			param.Method,
			param.Path,
			param.Request.Proto,
			param.StatusCode,
			param.Latency,
			param.Request.UserAgent(),
			param.ErrorMessage,
		)
		return ""
	})
}

// Recovery 恢复中间件
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		logger.Error("Panic recovered: %v", recovered)
		c.JSON(http.StatusInternalServerError, errors.NewErrorResponse(
			50001,
			"内部服务器错误",
			nil,
		))
	})
}

// CORS 跨域中间件
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		
		// 在生产环境中，应该配置具体的允许域名
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// RequestID 请求ID中间件
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.Request.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		
		c.Header("X-Request-ID", requestID)
		c.Set("request_id", requestID)
		c.Next()
	}
}

// Auth JWT认证中间件
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		var token string

		// 从Authorization header获取token
		authHeader := c.Request.Header.Get("Authorization")
		if authHeader != "" {
			// Bearer token格式
			tokenParts := strings.SplitN(authHeader, " ", 2)
			if len(tokenParts) == 2 && tokenParts[0] == "Bearer" {
				token = tokenParts[1]
			}
		}

		// 如果header中没有token，尝试从query参数中获取（用于SSE连接）
		if token == "" {
			token = c.Query("token")
		}

		// 如果两个地方都没有token
		if token == "" {
			c.JSON(http.StatusUnauthorized, errors.NewErrorResponse(
				20001,
				"缺少认证token",
				nil,
			))
			c.Abort()
			return
		}

		claims, err := jwt.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, errors.NewErrorResponse(
				20003,
				"认证token无效",
				nil,
			))
			c.Abort()
			return
		}

		// 检查token类型
		if claims.TokenType != "access" {
			c.JSON(http.StatusUnauthorized, errors.NewErrorResponse(
				20004,
				"token类型错误",
				nil,
			))
			c.Abort()
			return
		}

		// 将用户信息存储到上下文
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("department", claims.Department)

		c.Next()
	}
}

// RequireRole 角色权限中间件
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, errors.NewErrorResponse(
				20005,
				"无法获取用户角色信息",
				nil,
			))
			c.Abort()
			return
		}

		role := userRole.(string)
		allowed := false
		for _, allowedRole := range roles {
			if role == allowedRole {
				allowed = true
				break
			}
		}

		if !allowed {
			c.JSON(http.StatusForbidden, errors.NewErrorResponse(
				20006,
				"权限不足",
				nil,
			))
			c.Abort()
			return
		}

		c.Next()
	}
}

// RateLimit 限流中间件（简单实现，生产环境建议使用Redis）
func RateLimit() gin.HandlerFunc {
	// TODO: 实现基于Redis的限流
	return func(c *gin.Context) {
		c.Next()
	}
}