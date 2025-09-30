package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/cdnagent/cdnagent/internal/database/models"
	pkgErrors "github.com/cdnagent/cdnagent/pkg/errors"
)

type ToolHandler struct {
	db *gorm.DB
}

func NewToolHandler(db *gorm.DB) *ToolHandler {
	return &ToolHandler{db: db}
}

type CreateToolRequest struct {
	Name        string                 `json:"name" binding:"required,max=100"`
	DisplayName string                 `json:"displayName" binding:"required,max=100"`
	Description string                 `json:"description"`
	ToolType    string                 `json:"toolType" binding:"required,oneof=api webhook script"`
	Config      map[string]interface{} `json:"config" binding:"required"`
	AuthConfig  map[string]interface{} `json:"authConfig"`
	Enabled     *bool                  `json:"enabled"`
}

type UpdateToolRequest struct {
	DisplayName string                 `json:"displayName" binding:"max=100"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
	AuthConfig  map[string]interface{} `json:"authConfig"`
	Enabled     *bool                  `json:"enabled"`
}

type ExecuteToolRequest struct {
	InputParams map[string]interface{} `json:"inputParams" binding:"required"`
}

type ToolResponse struct {
	ID          uuid.UUID              `json:"id"`
	Name        string                 `json:"name"`
	DisplayName string                 `json:"displayName"`
	Description string                 `json:"description"`
	ToolType    string                 `json:"toolType"`
	Config      map[string]interface{} `json:"config"`
	AuthConfig  map[string]interface{} `json:"authConfig,omitempty"`
	Enabled     bool                   `json:"enabled"`
	CreatedBy   *uuid.UUID             `json:"createdBy"`
	CreatedAt   time.Time              `json:"createdAt"`
	UpdatedAt   time.Time              `json:"updatedAt"`
	Creator     *CreatorInfo           `json:"creator,omitempty"`
}

type ToolExecutionResponse struct {
	ID              uuid.UUID              `json:"id"`
	ToolID          uuid.UUID              `json:"toolId"`
	MessageID       *uuid.UUID             `json:"messageId"`
	UserID          uuid.UUID              `json:"userId"`
	InputParams     map[string]interface{} `json:"inputParams"`
	OutputResult    map[string]interface{} `json:"outputResult"`
	ExecutionTimeMs *int                   `json:"executionTimeMs"`
	Status          string                 `json:"status"`
	ErrorMessage    string                 `json:"errorMessage"`
	CreatedAt       time.Time              `json:"createdAt"`
	Tool            *ToolResponse          `json:"tool,omitempty"`
}

type CreatorInfo struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"displayName"`
}

func (h *ToolHandler) CreateTool(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")

	// 检查权限：只有管理员可以创建工具
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40301,
			"权限不足",
			nil,
		))
		return
	}

	var req CreateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40031,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 检查工具名称是否已存在
	var count int64
	if err := h.db.Model(&models.Tool{}).Where("name = ?", req.Name).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50031,
			"数据库查询失败",
			err.Error(),
		))
		return
	}

	if count > 0 {
		c.JSON(http.StatusConflict, pkgErrors.NewErrorResponse(
			40931,
			"工具名称已存在",
			nil,
		))
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	// 验证工具配置
	if err := h.validateToolConfig(req.ToolType, req.Config); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40032,
			"工具配置错误",
			err.Error(),
		))
		return
	}

	userUUID := userID.(uuid.UUID)
	tool := models.Tool{
		ID:          uuid.New(),
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		ToolType:    req.ToolType,
		Config:      req.Config,
		AuthConfig:  req.AuthConfig,
		Enabled:     enabled,
		CreatedBy:   &userUUID,
	}

	if err := h.db.Create(&tool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50032,
			"创建工具失败",
			err.Error(),
		))
		return
	}

	response := h.buildToolResponse(tool, nil)
	c.JSON(http.StatusCreated, pkgErrors.NewSuccessResponse(response))
}

func (h *ToolHandler) GetTools(c *gin.Context) {
    // 分页参数（优先驼峰，兼容下划线）
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSizeStr := c.Query("pageSize")
    if pageSizeStr == "" {
        pageSizeStr = c.DefaultQuery("page_size", "20")
    }
    pageSize, _ := strconv.Atoi(pageSizeStr)
    toolType := c.Query("toolType")
    if toolType == "" {
        toolType = c.Query("tool_type")
    }
    enabled := c.Query("enabled")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := h.db.Model(&models.Tool{})

	// 添加过滤条件
	if toolType != "" {
		query = query.Where("tool_type = ?", toolType)
	}
	if enabled != "" {
		if enabled == "true" {
			query = query.Where("enabled = ?", true)
		} else if enabled == "false" {
			query = query.Where("enabled = ?", false)
		}
	}

	var total int64
	query.Count(&total)

	var tools []models.Tool
	offset := (page - 1) * pageSize
	if err := query.Preload("Creator").
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&tools).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50033,
			"查询工具列表失败",
			err.Error(),
		))
		return
	}

	var responses []ToolResponse
	for _, tool := range tools {
		var creatorInfo *CreatorInfo
		if tool.Creator != nil {
			creatorInfo = &CreatorInfo{
				ID:          tool.Creator.ID,
				Username:    tool.Creator.Username,
				DisplayName: tool.Creator.DisplayName,
			}
		}
		responses = append(responses, h.buildToolResponse(tool, creatorInfo))
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

func (h *ToolHandler) GetTool(c *gin.Context) {
	toolID := c.Param("id")

	var tool models.Tool
	if err := h.db.Preload("Creator").Where("id = ?", toolID).First(&tool).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40431,
			"工具不存在",
			nil,
		))
		return
	}

	var creatorInfo *CreatorInfo
	if tool.Creator != nil {
		creatorInfo = &CreatorInfo{
			ID:          tool.Creator.ID,
			Username:    tool.Creator.Username,
			DisplayName: tool.Creator.DisplayName,
		}
	}

	response := h.buildToolResponse(tool, creatorInfo)
	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *ToolHandler) UpdateTool(c *gin.Context) {
	role, _ := c.Get("role")
	toolID := c.Param("id")

	// 检查权限：只有管理员可以更新工具
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40302,
			"权限不足",
			nil,
		))
		return
	}

	var tool models.Tool
	if err := h.db.Where("id = ?", toolID).First(&tool).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40432,
			"工具不存在",
			nil,
		))
		return
	}

	var req UpdateToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40033,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 更新工具
	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}

	if req.DisplayName != "" {
		updates["display_name"] = req.DisplayName
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Config != nil {
		// 验证新配置
		if err := h.validateToolConfig(tool.ToolType, req.Config); err != nil {
			c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
				40034,
				"工具配置错误",
				err.Error(),
			))
			return
		}
		updates["config"] = req.Config
	}
	if req.AuthConfig != nil {
		updates["auth_config"] = req.AuthConfig
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	if err := h.db.Model(&tool).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50034,
			"更新工具失败",
			err.Error(),
		))
		return
	}

	// 重新查询更新后的数据
	h.db.Preload("Creator").Where("id = ?", toolID).First(&tool)

	var creatorInfo *CreatorInfo
	if tool.Creator != nil {
		creatorInfo = &CreatorInfo{
			ID:          tool.Creator.ID,
			Username:    tool.Creator.Username,
			DisplayName: tool.Creator.DisplayName,
		}
	}

	response := h.buildToolResponse(tool, creatorInfo)
	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *ToolHandler) DeleteTool(c *gin.Context) {
	role, _ := c.Get("role")
	toolID := c.Param("id")

	// 检查权限：只有管理员可以删除工具
	if role.(string) != "admin" {
		c.JSON(http.StatusForbidden, pkgErrors.NewErrorResponse(
			40303,
			"权限不足",
			nil,
		))
		return
	}

	var tool models.Tool
	if err := h.db.Where("id = ?", toolID).First(&tool).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40433,
			"工具不存在",
			nil,
		))
		return
	}

	// 检查是否有执行记录
	var execCount int64
	h.db.Model(&models.ToolExecution{}).Where("tool_id = ?", toolID).Count(&execCount)
	if execCount > 0 {
		// 有执行记录，只禁用不删除
		if err := h.db.Model(&tool).Update("enabled", false).Error; err != nil {
			c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
				50035,
				"禁用工具失败",
				err.Error(),
			))
			return
		}
		c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse("工具已禁用"))
		return
	}

	// 没有执行记录，可以直接删除
	if err := h.db.Delete(&tool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50036,
			"删除工具失败",
			err.Error(),
		))
		return
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse("工具删除成功"))
}

func (h *ToolHandler) ExecuteTool(c *gin.Context) {
	userID, _ := c.Get("user_id")
	toolID := c.Param("id")

	var tool models.Tool
	if err := h.db.Where("id = ? AND enabled = ?", toolID, true).First(&tool).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40434,
			"工具不存在或已禁用",
			nil,
		))
		return
	}

	var req ExecuteToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40035,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 创建执行记录
	execution := models.ToolExecution{
		ID:          uuid.New(),
		ToolID:      tool.ID,
		UserID:      userID.(uuid.UUID),
		InputParams: req.InputParams,
		Status:      "pending",
	}

	if err := h.db.Create(&execution).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50037,
			"创建执行记录失败",
			err.Error(),
		))
		return
	}

	// 执行工具
	startTime := time.Now()
	result, err := h.executeToolLogic(tool, req.InputParams)
	executionTime := int(time.Since(startTime).Milliseconds())

	// 更新执行结果
	updates := map[string]interface{}{
		"execution_time_ms": executionTime,
	}

	if err != nil {
		updates["status"] = "failed"
		updates["error_message"] = err.Error()
	} else {
		updates["status"] = "success"
		updates["output_result"] = result
	}

	h.db.Model(&execution).Updates(updates)

	// 重新查询执行记录
	h.db.Preload("Tool").Where("id = ?", execution.ID).First(&execution)

	response := h.buildExecutionResponse(execution)
	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *ToolHandler) GetExecutions(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")

    // 分页参数（优先驼峰，兼容下划线）
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSizeStr := c.Query("pageSize")
    if pageSizeStr == "" {
        pageSizeStr = c.DefaultQuery("page_size", "20")
    }
    pageSize, _ := strconv.Atoi(pageSizeStr)
    toolID := c.Query("toolId")
    if toolID == "" {
        toolID = c.Query("tool_id")
    }
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := h.db.Model(&models.ToolExecution{})

	// 非管理员只能查看自己的执行记录
	if role.(string) != "admin" {
		query = query.Where("user_id = ?", userID)
	}

	// 添加过滤条件
	if toolID != "" {
		query = query.Where("tool_id = ?", toolID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var executions []models.ToolExecution
	offset := (page - 1) * pageSize
	if err := query.Preload("Tool").Preload("User").
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&executions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50038,
			"查询执行记录失败",
			err.Error(),
		))
		return
	}

	var responses []ToolExecutionResponse
	for _, execution := range executions {
		responses = append(responses, h.buildExecutionResponse(execution))
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

func (h *ToolHandler) validateToolConfig(toolType string, config map[string]interface{}) error {
	switch toolType {
	case "api":
		// 验证API工具配置
		if _, ok := config["url"]; !ok {
			return errors.New("API工具需要配置url")
		}
		if _, ok := config["method"]; !ok {
			return errors.New("API工具需要配置method")
		}
	case "webhook":
		// 验证Webhook工具配置
		if _, ok := config["url"]; !ok {
			return errors.New("Webhook工具需要配置url")
		}
	case "script":
		// 验证脚本工具配置
		if _, ok := config["script"]; !ok {
			return errors.New("脚本工具需要配置script")
		}
		if _, ok := config["language"]; !ok {
			return errors.New("脚本工具需要配置language")
		}
	}
	return nil
}

func (h *ToolHandler) executeToolLogic(tool models.Tool, params map[string]interface{}) (map[string]interface{}, error) {
	// TODO: 实现实际的工具执行逻辑
	// 这里只是模拟执行
	switch tool.ToolType {
	case "api":
		return h.executeAPITool(tool, params)
	case "webhook":
		return h.executeWebhookTool(tool, params)
	case "script":
		return h.executeScriptTool(tool, params)
	default:
		return nil, errors.New("不支持的工具类型")
	}
}

func (h *ToolHandler) executeAPITool(tool models.Tool, params map[string]interface{}) (map[string]interface{}, error) {
	// 模拟API调用
	return map[string]interface{}{
		"status": "success",
		"data":   "API调用成功",
		"params": params,
	}, nil
}

func (h *ToolHandler) executeWebhookTool(tool models.Tool, params map[string]interface{}) (map[string]interface{}, error) {
	// 模拟Webhook调用
	return map[string]interface{}{
		"status": "success",
		"data":   "Webhook调用成功",
		"params": params,
	}, nil
}

func (h *ToolHandler) executeScriptTool(tool models.Tool, params map[string]interface{}) (map[string]interface{}, error) {
	// 模拟脚本执行
	return map[string]interface{}{
		"status": "success",
		"output": "脚本执行成功",
		"params": params,
	}, nil
}

func (h *ToolHandler) buildToolResponse(tool models.Tool, creator *CreatorInfo) ToolResponse {
	response := ToolResponse{
		ID:          tool.ID,
		Name:        tool.Name,
		DisplayName: tool.DisplayName,
		Description: tool.Description,
		ToolType:    tool.ToolType,
		Config:      tool.Config,
		Enabled:     tool.Enabled,
		CreatedBy:   tool.CreatedBy,
		CreatedAt:   tool.CreatedAt,
		UpdatedAt:   tool.UpdatedAt,
		Creator:     creator,
	}

	// 不返回敏感的认证配置给普通用户
	if tool.AuthConfig != nil {
		// 这里可以根据用户权限决定是否返回认证配置
		response.AuthConfig = tool.AuthConfig
	}

	return response
}

func (h *ToolHandler) buildExecutionResponse(execution models.ToolExecution) ToolExecutionResponse {
	response := ToolExecutionResponse{
		ID:              execution.ID,
		ToolID:          execution.ToolID,
		MessageID:       execution.MessageID,
		UserID:          execution.UserID,
		InputParams:     execution.InputParams,
		OutputResult:    execution.OutputResult,
		ExecutionTimeMs: execution.ExecutionTimeMs,
		Status:          execution.Status,
		ErrorMessage:    execution.ErrorMessage,
		CreatedAt:       execution.CreatedAt,
	}

	if execution.Tool.ID != uuid.Nil {
		response.Tool = &ToolResponse{
			ID:          execution.Tool.ID,
			Name:        execution.Tool.Name,
			DisplayName: execution.Tool.DisplayName,
			Description: execution.Tool.Description,
			ToolType:    execution.Tool.ToolType,
		}
	}

	return response
}
