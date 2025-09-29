package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/cdnagent/cdnagent/internal/database/models"
	"github.com/cdnagent/cdnagent/internal/pkg/jwt"
	"github.com/cdnagent/cdnagent/pkg/errors"
)

type AuthHandler struct {
	db *gorm.DB
}

func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=6"`
}

type RegisterRequest struct {
	Username    string `json:"username" binding:"required,min=3,max=50"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=6"`
	DisplayName string `json:"display_name" binding:"max=100"`
	Department  string `json:"department" binding:"max=50"`
}

type LoginResponse struct {
	AccessToken  string     `json:"accessToken"`
	RefreshToken string     `json:"refreshToken"`
	ExpiresIn    int64      `json:"expiresIn"`
	User         *UserInfo  `json:"user"`
}

type UserInfo struct {
	ID          uuid.UUID  `json:"id"`
	Username    string     `json:"username"`
	Email       string     `json:"email"`
	DisplayName string     `json:"displayName"`
	AvatarURL   string     `json:"avatarURL"`
	Role        string     `json:"role"`
	Department  string     `json:"department"`
	Status      string     `json:"status"`
	LastLoginAt *time.Time `json:"lastLoginAt"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errors.NewErrorResponse(
			40001,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 查找用户
	var user models.User
	if err := h.db.Where("username = ? AND status = ?", req.Username, "active").First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, errors.NewErrorResponse(
			40101,
			"用户名或密码错误",
			nil,
		))
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, errors.NewErrorResponse(
			40102,
			"用户名或密码错误",
			nil,
		))
		return
	}

	// 生成JWT令牌
	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Username, user.Role, user.Department)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewErrorResponse(
			50002,
			"生成令牌失败",
			err.Error(),
		))
		return
	}

	// 更新最后登录时间
	now := time.Now()
	h.db.Model(&user).Update("last_login_at", now)

	// 创建用户会话记录
	session := models.UserSession{
		UserID:    user.ID,
		TokenHash: tokenPair.AccessToken[:32], // 存储token前32字符作为标识
		DeviceInfo: map[string]interface{}{
			"user_agent": c.Request.Header.Get("User-Agent"),
		},
		IPAddress: c.ClientIP(),
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	h.db.Create(&session)

	response := LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		User: &UserInfo{
			ID:          user.ID,
			Username:    user.Username,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
			Role:        user.Role,
			Department:  user.Department,
			Status:      user.Status,
			LastLoginAt: &now,
		},
	}

	c.JSON(http.StatusOK, errors.NewSuccessResponse(response))
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errors.NewErrorResponse(
			40002,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 检查用户名和邮箱是否已存在
	var count int64
	if err := h.db.Model(&models.User{}).Where("username = ? OR email = ?", req.Username, req.Email).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewErrorResponse(
			50003,
			"数据库查询失败",
			err.Error(),
		))
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, errors.NewErrorResponse(
			40901,
			"用户名或邮箱已存在",
			nil,
		))
		return
	}

	// 加密密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewErrorResponse(
			50004,
			"密码加密失败",
			err.Error(),
		))
		return
	}

	// 创建用户
	user := models.User{
		ID:           uuid.New(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		DisplayName:  req.DisplayName,
		Role:         "user", // 默认为普通用户
		Department:   req.Department,
		Status:       "active",
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewErrorResponse(
			50005,
			"创建用户失败",
			err.Error(),
		))
		return
	}

	// 生成JWT令牌
	tokenPair, err := jwt.GenerateTokenPair(user.ID, user.Username, user.Role, user.Department)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errors.NewErrorResponse(
			50006,
			"生成令牌失败",
			err.Error(),
		))
		return
	}

	response := LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		ExpiresIn:    tokenPair.ExpiresIn,
		User: &UserInfo{
			ID:          user.ID,
			Username:    user.Username,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
			Role:        user.Role,
			Department:  user.Department,
			Status:      user.Status,
		},
	}

	c.JSON(http.StatusCreated, errors.NewSuccessResponse(response))
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errors.NewErrorResponse(
			40003,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 验证并刷新令牌
	tokenPair, err := jwt.RefreshAccessToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errors.NewErrorResponse(
			40103,
			"刷新令牌无效",
			err.Error(),
		))
		return
	}

	c.JSON(http.StatusOK, errors.NewSuccessResponse(tokenPair))
}

func (h *AuthHandler) Logout(c *gin.Context) {
	// 从上下文获取用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, errors.NewErrorResponse(
			40104,
			"未认证",
			nil,
		))
		return
	}

	// 删除用户会话（这里简化处理，实际应该根据token删除特定会话）
	h.db.Where("user_id = ?", userID).Delete(&models.UserSession{})

	c.JSON(http.StatusOK, errors.NewSuccessResponse("退出登录成功"))
}

func (h *AuthHandler) Profile(c *gin.Context) {
	// 从上下文获取用户信息
	userID, _ := c.Get("user_id")
	username, _ := c.Get("username")
	role, _ := c.Get("role")
	department, _ := c.Get("department")

	// 查询完整用户信息
	var user models.User
	if err := h.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, errors.NewErrorResponse(
			40401,
			"用户不存在",
			nil,
		))
		return
	}

	userInfo := UserInfo{
		ID:          user.ID,
		Username:    username.(string),
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		Role:        role.(string),
		Department:  department.(string),
		Status:      user.Status,
		LastLoginAt: user.LastLoginAt,
	}

	c.JSON(http.StatusOK, errors.NewSuccessResponse(userInfo))
}