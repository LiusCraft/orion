package routes

import (
	"github.com/gin-gonic/gin"

	"github.com/cdnagent/cdnagent/internal/api/handlers"
	"github.com/cdnagent/cdnagent/internal/api/middleware"
)

func SetupAuthRoutes(rg *gin.RouterGroup, handler *handlers.AuthHandler) {
	auth := rg.Group("/auth")
	{
		auth.POST("/login", handler.Login)
		auth.POST("/register", handler.Register)
		auth.POST("/refresh", handler.RefreshToken)
		
		// 需要认证的路由
		authenticated := auth.Group("/")
		authenticated.Use(middleware.Auth())
		{
			authenticated.POST("/logout", handler.Logout)
			authenticated.GET("/profile", handler.Profile)
		}
	}
}

func SetupChatRoutes(rg *gin.RouterGroup, handler *handlers.ChatHandler) {
	chat := rg.Group("/chat")
	chat.Use(middleware.Auth()) // 所有聊天API都需要认证
	{
		// 对话管理
		chat.POST("/conversations", handler.CreateConversation)
		chat.GET("/conversations", handler.GetConversations)
		chat.GET("/conversations/:id", handler.GetConversation)
		chat.PUT("/conversations/:id", handler.UpdateConversation)
		chat.DELETE("/conversations/:id", handler.DeleteConversation)
		
		// 消息管理
		chat.GET("/conversations/:id/messages", handler.GetMessages)
		chat.POST("/conversations/:id/messages", handler.SendMessage)
	}
}

func SetupKnowledgeRoutes(rg *gin.RouterGroup, handler *handlers.KnowledgeHandler) {
	knowledge := rg.Group("/knowledge")
	{
		// 分类管理（公开读取，需要认证才能修改）
		knowledge.GET("/categories", handler.GetCategories)
		
		authenticated := knowledge.Group("/")
		authenticated.Use(middleware.Auth())
		{
			// 分类管理
			authenticated.POST("/categories", handler.CreateCategory)
			authenticated.PUT("/categories/:id", handler.UpdateCategory)
			authenticated.DELETE("/categories/:id", handler.DeleteCategory)
			
			// 文档管理
			authenticated.POST("/documents", handler.CreateDocument)
			authenticated.PUT("/documents/:id", handler.UpdateDocument)
			authenticated.DELETE("/documents/:id", handler.DeleteDocument)
			
			// 文档搜索
			authenticated.POST("/documents/search", handler.SearchDocuments)
		}
		
		// 文档查看（公开读取）
		knowledge.GET("/documents", handler.GetDocuments)
		knowledge.GET("/documents/:id", handler.GetDocument)
	}
}

func SetupToolRoutes(rg *gin.RouterGroup, handler *handlers.ToolHandler) {
	tools := rg.Group("/tools")
	tools.Use(middleware.Auth()) // 所有工具API都需要认证
	{
		// 工具管理
		tools.GET("", handler.GetTools)
		tools.GET("/:id", handler.GetTool)
		tools.POST("", handler.CreateTool)
		tools.PUT("/:id", handler.UpdateTool)
		tools.DELETE("/:id", handler.DeleteTool)
		
		// 工具执行
		tools.POST("/:id/execute", handler.ExecuteTool)
		tools.GET("/executions", handler.GetExecutions)
	}
}

func SetupAdminRoutes(rg *gin.RouterGroup, handler *handlers.AdminHandler) {
	admin := rg.Group("/admin")
	admin.Use(middleware.Auth())                    // 需要认证
	admin.Use(middleware.RequireRole("admin"))     // 需要管理员权限
	{
		// 用户管理
		users := admin.Group("/users")
		{
			users.POST("", handler.CreateUser)
			users.GET("", handler.GetUsers)
			users.GET("/:id", handler.GetUser)
			users.PUT("/:id", handler.UpdateUser)
			users.DELETE("/:id", handler.DeleteUser)
		}
		
		// 系统配置管理
		configs := admin.Group("/configs")
		{
			configs.POST("", handler.CreateSystemConfig)
			configs.GET("", handler.GetSystemConfigs)
			configs.PUT("/:id", handler.UpdateSystemConfig)
			configs.DELETE("/:id", handler.DeleteSystemConfig)
		}
		
		// 系统统计
		admin.GET("/stats", handler.GetSystemStats)
	}
}