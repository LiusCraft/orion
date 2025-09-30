package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/cdnagent/cdnagent/internal/database/models"
	pkgErrors "github.com/cdnagent/cdnagent/pkg/errors"
)

type AdminHandler struct {
	db *gorm.DB
}

func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{db: db}
}

type CreateUserRequest struct {
    Username    string `json:"username" binding:"required,min=3,max=50"`
    Email       string `json:"email" binding:"required,email"`
    Password    string `json:"password" binding:"required,min=6"`
    DisplayName string `json:"displayName" binding:"max=100"`
    Role        string `json:"role" binding:"required,oneof=admin user viewer"`
    Department  string `json:"department" binding:"max=50"`
    Status      string `json:"status" binding:"oneof=active inactive"`
}

type UpdateUserRequest struct {
    DisplayName string `json:"displayName" binding:"max=100"`
    Role        string `json:"role" binding:"oneof=admin user viewer"`
    Department  string `json:"department" binding:"max=50"`
    Status      string `json:"status" binding:"oneof=active inactive suspended"`
}

type SystemConfigRequest struct {
    ConfigKey   string                 `json:"configKey" binding:"required,max=100"`
    ConfigValue map[string]interface{} `json:"configValue" binding:"required"`
    Description string                 `json:"description"`
    ConfigType  string                 `json:"configType" binding:"required,max=50"`
    IsEncrypted bool                   `json:"isEncrypted"`
}

type UserManagementResponse struct {
    ID          uuid.UUID  `json:"id"`
    Username    string     `json:"username"`
    Email       string     `json:"email"`
    DisplayName string     `json:"displayName"`
    AvatarURL   string     `json:"avatarUrl"`
    Role        string     `json:"role"`
    Department  string     `json:"department"`
    Status      string     `json:"status"`
    LastLoginAt *time.Time `json:"lastLoginAt"`
    CreatedAt   time.Time  `json:"createdAt"`
    UpdatedAt   time.Time  `json:"updatedAt"`
}

type SystemConfigResponse struct {
    ID            uuid.UUID              `json:"id"`
    ConfigKey     string                 `json:"configKey"`
    ConfigValue   map[string]interface{} `json:"configValue"`
    Description   string                 `json:"description"`
    ConfigType    string                 `json:"configType"`
    IsEncrypted   bool                   `json:"isEncrypted"`
    UpdatedBy     *uuid.UUID             `json:"updatedBy"`
    CreatedAt     time.Time              `json:"createdAt"`
    UpdatedAt     time.Time              `json:"updatedAt"`
    UpdatedByUser *UserManagementResponse `json:"updatedByUser,omitempty"`
}

type SystemStatsResponse struct {
    TotalUsers         int64 `json:"totalUsers"`
    ActiveUsers        int64 `json:"activeUsers"`
    TotalConversations int64 `json:"totalConversations"`
    TotalMessages      int64 `json:"totalMessages"`
    TotalDocuments     int64 `json:"totalDocuments"`
    TotalTools         int64 `json:"totalTools"`
    TodayMessages      int64 `json:"todayMessages"`
    TodayUsers         int64 `json:"todayUsers"`
}

// 用户管理
func (h *AdminHandler) CreateUser(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40304,
			"权限不足",
			nil,
		))
		return
	}

	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40041,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 检查用户名和邮箱是否已存在
	var count int64
	if err := h.db.Model(&models.User{}).Where("username = ? OR email = ?", req.Username, req.Email).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50041,
			"数据库查询失败",
			err.Error(),
		))
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, pkgErrors.NewErrorResponse(
			40941,
			"用户名或邮箱已存在",
			nil,
		))
		return
	}

	// 创建用户（这里简化处理，实际应该发送邮件让用户设置密码）
	user := models.User{
		ID:          uuid.New(),
		Username:    req.Username,
		Email:       req.Email,
		PasswordHash: "temp_password", // TODO: 应该生成临时密码并发送邮件
		DisplayName: req.DisplayName,
		Role:        req.Role,
		Department:  req.Department,
		Status:      "active",
	}

	if req.Status != "" {
		user.Status = req.Status
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50042,
			"创建用户失败",
			err.Error(),
		))
		return
	}

	response := UserManagementResponse{
		ID:          user.ID,
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		Role:        user.Role,
		Department:  user.Department,
		Status:      user.Status,
		LastLoginAt: user.LastLoginAt,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
	}

	c.JSON(http.StatusCreated, pkgErrors.NewSuccessResponse(response))
}

func (h *AdminHandler) GetUsers(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40305,
			"权限不足",
			nil,
		))
		return
	}

    // 分页参数（优先驼峰，兼容下划线）
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSizeStr := c.Query("pageSize")
    if pageSizeStr == "" {
        pageSizeStr = c.DefaultQuery("page_size", "20")
    }
    pageSize, _ := strconv.Atoi(pageSizeStr)
	userRole := c.Query("role")
	status := c.Query("status")
	department := c.Query("department")
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := h.db.Model(&models.User{})

	// 添加过滤条件
	if userRole != "" {
		query = query.Where("role = ?", userRole)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if department != "" {
		query = query.Where("department = ?", department)
	}
	if search != "" {
		query = query.Where("username ILIKE ? OR email ILIKE ? OR display_name ILIKE ?", 
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var users []models.User
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50043,
			"查询用户列表失败",
			err.Error(),
		))
		return
	}

	var responses []UserManagementResponse
	for _, user := range users {
		responses = append(responses, UserManagementResponse{
			ID:          user.ID,
			Username:    user.Username,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			AvatarURL:   user.AvatarURL,
			Role:        user.Role,
			Department:  user.Department,
			Status:      user.Status,
			LastLoginAt: user.LastLoginAt,
			CreatedAt:   user.CreatedAt,
			UpdatedAt:   user.UpdatedAt,
		})
	}

    result := map[string]interface{}{
        "data": responses,
        "pagination": map[string]interface{}{
            "page":      page,
            "pageSize":  pageSize,
            "total":     total,
            "totalPage": (total + int64(pageSize) - 1) / int64(pageSize),
        },
    }

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(result))
}

func (h *AdminHandler) GetUser(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40306,
			"权限不足",
			nil,
		))
		return
	}

	userID := c.Param("id")

	var user models.User
	if err := h.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40441,
			"用户不存在",
			nil,
		))
		return
	}

	response := UserManagementResponse{
		ID:          user.ID,
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		Role:        user.Role,
		Department:  user.Department,
		Status:      user.Status,
		LastLoginAt: user.LastLoginAt,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *AdminHandler) UpdateUser(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40307,
			"权限不足",
			nil,
		))
		return
	}

	userID := c.Param("id")

	var user models.User
	if err := h.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40442,
			"用户不存在",
			nil,
		))
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40042,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 更新用户
	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}

	if req.DisplayName != "" {
		updates["display_name"] = req.DisplayName
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Department != "" {
		updates["department"] = req.Department
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}

	if err := h.db.Model(&user).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50044,
			"更新用户失败",
			err.Error(),
		))
		return
	}

	// 重新查询更新后的数据
	h.db.Where("id = ?", userID).First(&user)

	response := UserManagementResponse{
		ID:          user.ID,
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		AvatarURL:   user.AvatarURL,
		Role:        user.Role,
		Department:  user.Department,
		Status:      user.Status,
		LastLoginAt: user.LastLoginAt,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *AdminHandler) DeleteUser(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40308,
			"权限不足",
			nil,
		))
		return
	}

	userID := c.Param("id")
	currentUserID, _ := c.Get("user_id")

	// 不能删除自己
	if userID == currentUserID.(uuid.UUID).String() {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40043,
			"不能删除自己",
			nil,
		))
		return
	}

	var user models.User
	if err := h.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40443,
			"用户不存在",
			nil,
		))
		return
	}

	// 软删除：设置状态为inactive
	if err := h.db.Model(&user).Update("status", "inactive").Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50045,
			"删除用户失败",
			err.Error(),
		))
		return
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse("用户删除成功"))
}

// 系统配置管理
func (h *AdminHandler) CreateSystemConfig(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40309,
			"权限不足",
			nil,
		))
		return
	}

	userID, _ := c.Get("user_id")

	var req SystemConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40044,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 检查配置键是否已存在
	var count int64
	if err := h.db.Model(&models.SystemConfig{}).Where("config_key = ?", req.ConfigKey).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50046,
			"数据库查询失败",
			err.Error(),
		))
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, pkgErrors.NewErrorResponse(
			40942,
			"配置键已存在",
			nil,
		))
		return
	}

	userUUID := userID.(uuid.UUID)
	config := models.SystemConfig{
		ID:          uuid.New(),
		ConfigKey:   req.ConfigKey,
		ConfigValue: req.ConfigValue,
		Description: req.Description,
		ConfigType:  req.ConfigType,
		IsEncrypted: req.IsEncrypted,
		UpdatedBy:   &userUUID,
	}

	if err := h.db.Create(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50047,
			"创建配置失败",
			err.Error(),
		))
		return
	}

	response := SystemConfigResponse{
		ID:          config.ID,
		ConfigKey:   config.ConfigKey,
		ConfigValue: config.ConfigValue,
		Description: config.Description,
		ConfigType:  config.ConfigType,
		IsEncrypted: config.IsEncrypted,
		UpdatedBy:   config.UpdatedBy,
		CreatedAt:   config.CreatedAt,
		UpdatedAt:   config.UpdatedAt,
	}

	c.JSON(http.StatusCreated, pkgErrors.NewSuccessResponse(response))
}

func (h *AdminHandler) GetSystemConfigs(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40310,
			"权限不足",
			nil,
		))
		return
	}

	configType := c.Query("config_type")

	query := h.db.Model(&models.SystemConfig{})
	if configType != "" {
		query = query.Where("config_type = ?", configType)
	}

	var configs []models.SystemConfig
	if err := query.Preload("UpdatedByUser").
		Order("config_type ASC, config_key ASC").
		Find(&configs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50048,
			"查询配置列表失败",
			err.Error(),
		))
		return
	}

	var responses []SystemConfigResponse
	for _, config := range configs {
		var updatedByUser *UserManagementResponse
		if config.UpdatedByUser != nil {
			updatedByUser = &UserManagementResponse{
				ID:          config.UpdatedByUser.ID,
				Username:    config.UpdatedByUser.Username,
				DisplayName: config.UpdatedByUser.DisplayName,
			}
		}

		responses = append(responses, SystemConfigResponse{
			ID:            config.ID,
			ConfigKey:     config.ConfigKey,
			ConfigValue:   config.ConfigValue,
			Description:   config.Description,
			ConfigType:    config.ConfigType,
			IsEncrypted:   config.IsEncrypted,
			UpdatedBy:     config.UpdatedBy,
			CreatedAt:     config.CreatedAt,
			UpdatedAt:     config.UpdatedAt,
			UpdatedByUser: updatedByUser,
		})
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(responses))
}

func (h *AdminHandler) UpdateSystemConfig(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40311,
			"权限不足",
			nil,
		))
		return
	}

	userID, _ := c.Get("user_id")
	configID := c.Param("id")

	var config models.SystemConfig
	if err := h.db.Where("id = ?", configID).First(&config).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40444,
			"配置不存在",
			nil,
		))
		return
	}

	var req SystemConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40045,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 更新配置
	updates := map[string]interface{}{
		"config_value": req.ConfigValue,
		"description":  req.Description,
		"config_type":  req.ConfigType,
		"is_encrypted": req.IsEncrypted,
		"updated_by":   userID,
		"updated_at":   time.Now(),
	}

	if err := h.db.Model(&config).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50049,
			"更新配置失败",
			err.Error(),
		))
		return
	}

	// 重新查询更新后的数据
	h.db.Preload("UpdatedByUser").Where("id = ?", configID).First(&config)

	var updatedByUser *UserManagementResponse
	if config.UpdatedByUser != nil {
		updatedByUser = &UserManagementResponse{
			ID:          config.UpdatedByUser.ID,
			Username:    config.UpdatedByUser.Username,
			DisplayName: config.UpdatedByUser.DisplayName,
		}
	}

	response := SystemConfigResponse{
		ID:            config.ID,
		ConfigKey:     config.ConfigKey,
		ConfigValue:   config.ConfigValue,
		Description:   config.Description,
		ConfigType:    config.ConfigType,
		IsEncrypted:   config.IsEncrypted,
		UpdatedBy:     config.UpdatedBy,
		CreatedAt:     config.CreatedAt,
		UpdatedAt:     config.UpdatedAt,
		UpdatedByUser: updatedByUser,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *AdminHandler) DeleteSystemConfig(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40312,
			"权限不足",
			nil,
		))
		return
	}

	configID := c.Param("id")

	var config models.SystemConfig
	if err := h.db.Where("id = ?", configID).First(&config).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40445,
			"配置不存在",
			nil,
		))
		return
	}

	if err := h.db.Delete(&config).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50050,
			"删除配置失败",
			err.Error(),
		))
		return
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse("配置删除成功"))
}

// 系统统计
func (h *AdminHandler) GetSystemStats(c *gin.Context) {
	role, _ := c.Get("role")
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40313,
			"权限不足",
			nil,
		))
		return
	}

	var stats SystemStatsResponse

	// 统计用户数据
	h.db.Model(&models.User{}).Count(&stats.TotalUsers)
	h.db.Model(&models.User{}).Where("status = ?", "active").Count(&stats.ActiveUsers)

	// 统计对话和消息数据
	h.db.Model(&models.Conversation{}).Where("status = ?", "active").Count(&stats.TotalConversations)
	h.db.Model(&models.Message{}).Count(&stats.TotalMessages)

	// 统计文档数据
	h.db.Model(&models.KnowledgeDocument{}).Where("status = ?", "published").Count(&stats.TotalDocuments)

	// 统计工具数据
	h.db.Model(&models.Tool{}).Where("enabled = ?", true).Count(&stats.TotalTools)

	// 统计今日数据
	today := time.Now().Truncate(24 * time.Hour)
	h.db.Model(&models.Message{}).Where("created_at >= ?", today).Count(&stats.TodayMessages)
	
	// 今日活跃用户（今日有登录或发送消息的用户）
	h.db.Model(&models.User{}).Where("last_login_at >= ?", today).Count(&stats.TodayUsers)

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(stats))
}
