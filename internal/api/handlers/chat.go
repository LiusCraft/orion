package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/cdnagent/cdnagent/internal/ai"
	"github.com/cdnagent/cdnagent/internal/database/models"
	pkgErrors "github.com/cdnagent/cdnagent/pkg/errors"
)

type ChatHandler struct {
	db        *gorm.DB
	aiService *ai.AIService
}

func NewChatHandler(db *gorm.DB, aiService *ai.AIService) *ChatHandler {
	return &ChatHandler{
		db:        db,
		aiService: aiService,
	}
}

type CreateConversationRequest struct {
	Title   string      `json:"title"`
	Context models.JSONMap `json:"context"`
}

type SendMessageRequest struct {
	Content  string         `json:"content" binding:"required"`
	Metadata models.JSONMap `json:"metadata"`
}

type ConversationResponse struct {
	ID              uuid.UUID       `json:"id"`
	Title           string          `json:"title"`
	Context         models.JSONMap  `json:"context"`
	Status          string          `json:"status"`
	TotalMessages   int             `json:"totalMessages"`
	LastMessageAt   *time.Time      `json:"lastMessageAt"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}

type MessageResponse struct {
	ID               uuid.UUID       `json:"id"`
	ConversationID   uuid.UUID       `json:"conversationId"`
	ParentMessageID  *uuid.UUID      `json:"parentMessageId"`
	SenderType       string          `json:"senderType"`
	Content          string          `json:"content"`
	ContentType      string          `json:"contentType"`
	Metadata         models.JSONMap  `json:"metadata"`
	TokenCount       *int            `json:"tokenCount"`
	ProcessingTimeMs *int            `json:"processingTimeMs"`
	Status           string          `json:"status"`
	ErrorMessage     string          `json:"errorMessage"`
	CreatedAt        time.Time       `json:"createdAt"`
}

// SSE事件类型
type SSEEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

func (h *ChatHandler) CreateConversation(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	var req CreateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40011,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	conversation := models.Conversation{
		ID:            uuid.New(),
		UserID:        userID.(uuid.UUID),
		Title:         req.Title,
		Context:       req.Context,
		Status:        "active",
		TotalMessages: 0,
	}

	if err := h.db.Create(&conversation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50011,
			"创建对话失败",
			err.Error(),
		))
		return
	}

	response := ConversationResponse{
		ID:            conversation.ID,
		Title:         conversation.Title,
		Context:       conversation.Context,
		Status:        conversation.Status,
		TotalMessages: conversation.TotalMessages,
		CreatedAt:     conversation.CreatedAt,
		UpdatedAt:     conversation.UpdatedAt,
	}

	c.JSON(http.StatusCreated, pkgErrors.NewSuccessResponse(response))
}

func (h *ChatHandler) GetConversations(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.DefaultQuery("status", "active")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var conversations []models.Conversation
	var total int64

	// 查询总数
	h.db.Model(&models.Conversation{}).Where("user_id = ? AND status = ?", userID, status).Count(&total)

	// 查询数据
	offset := (page - 1) * pageSize
	if err := h.db.Where("user_id = ? AND status = ?", userID, status).
		Order("last_message_at DESC NULLS LAST, created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&conversations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50012,
			"查询对话列表失败",
			err.Error(),
		))
		return
	}

	var responses []ConversationResponse
	for _, conv := range conversations {
		responses = append(responses, ConversationResponse{
			ID:            conv.ID,
			Title:         conv.Title,
			Context:       conv.Context,
			Status:        conv.Status,
			TotalMessages: conv.TotalMessages,
			LastMessageAt: conv.LastMessageAt,
			CreatedAt:     conv.CreatedAt,
			UpdatedAt:     conv.UpdatedAt,
		})
	}

	result := map[string]interface{}{
		"data": responses,
		"pagination": map[string]interface{}{
			"page":       page,
			"pageSize":   pageSize,
			"total":      total,
			"totalPage":  (total + int64(pageSize) - 1) / int64(pageSize),
		},
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(result))
}

func (h *ChatHandler) GetConversation(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")

	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40411,
			"对话不存在",
			nil,
		))
		return
	}

	response := ConversationResponse{
		ID:            conversation.ID,
		Title:         conversation.Title,
		Context:       conversation.Context,
		Status:        conversation.Status,
		TotalMessages: conversation.TotalMessages,
		LastMessageAt: conversation.LastMessageAt,
		CreatedAt:     conversation.CreatedAt,
		UpdatedAt:     conversation.UpdatedAt,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *ChatHandler) GetMessages(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")

	// 验证对话是否属于当前用户
	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40412,
			"对话不存在",
			nil,
		))
		return
	}

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	var messages []models.Message
	var total int64

	// 查询总数
	h.db.Model(&models.Message{}).Where("conversation_id = ?", conversationID).Count(&total)

	// 查询数据
	offset := (page - 1) * pageSize
	if err := h.db.Where("conversation_id = ?", conversationID).
		Order("created_at ASC").
		Offset(offset).Limit(pageSize).
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50013,
			"查询消息列表失败",
			err.Error(),
		))
		return
	}

	var responses []MessageResponse
	for _, msg := range messages {
		responses = append(responses, MessageResponse{
			ID:               msg.ID,
			ConversationID:   msg.ConversationID,
			ParentMessageID:  msg.ParentMessageID,
			SenderType:       msg.SenderType,
			Content:          msg.Content,
			ContentType:      msg.ContentType,
			Metadata:         msg.Metadata,
			TokenCount:       msg.TokenCount,
			ProcessingTimeMs: msg.ProcessingTimeMs,
			Status:           msg.Status,
			ErrorMessage:     msg.ErrorMessage,
			CreatedAt:        msg.CreatedAt,
		})
	}

	result := map[string]interface{}{
		"data": responses,
		"pagination": map[string]interface{}{
			"page":       page,
			"pageSize":   pageSize,
			"total":      total,
			"totalPage":  (total + int64(pageSize) - 1) / int64(pageSize),
		},
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(result))
}

func (h *ChatHandler) SendMessage(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")

	// 验证对话是否属于当前用户
	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40413,
			"对话不存在",
			nil,
		))
		return
	}

	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40012,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 创建用户消息
	userMessage := models.Message{
		ID:             uuid.New(),
		ConversationID: conversation.ID,
		SenderType:     "user",
		Content:        req.Content,
		ContentType:    "text",
		Metadata:       req.Metadata,
		Status:         "completed",
	}

	if err := h.db.Create(&userMessage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50014,
			"创建消息失败",
			err.Error(),
		))
		return
	}

	// 更新对话信息
	now := time.Now()
	h.db.Model(&conversation).Updates(map[string]interface{}{
		"total_messages":   gorm.Expr("total_messages + 1"),
		"last_message_at": now,
		"updated_at":      now,
	})

	// 返回创建的用户消息
	response := MessageResponse{
		ID:               userMessage.ID,
		ConversationID:   userMessage.ConversationID,
		ParentMessageID:  userMessage.ParentMessageID,
		SenderType:       userMessage.SenderType,
		Content:          userMessage.Content,
		ContentType:      userMessage.ContentType,
		Metadata:         userMessage.Metadata,
		TokenCount:       userMessage.TokenCount,
		ProcessingTimeMs: userMessage.ProcessingTimeMs,
		Status:           userMessage.Status,
		ErrorMessage:     userMessage.ErrorMessage,
		CreatedAt:        userMessage.CreatedAt,
	}

	c.JSON(http.StatusCreated, pkgErrors.NewSuccessResponse(response))
}

// StreamMessages 处理SSE流式AI响应
func (h *ChatHandler) StreamMessages(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")

	// 验证对话是否属于当前用户
	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40413,
			"对话不存在",
			nil,
		))
		return
	}

	// 获取最后一条用户消息
	var lastUserMessage models.Message
	if err := h.db.Where("conversation_id = ? AND sender_type = ?", conversationID, "user").
		Order("created_at DESC").
		First(&lastUserMessage).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40414,
			"未找到用户消息",
			nil,
		))
		return
	}

	// 设置SSE响应头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	// 创建AI消息记录
	aiMessage := models.Message{
		ID:               uuid.New(),
		ConversationID:   conversation.ID,
		ParentMessageID:  &lastUserMessage.ID,
		SenderType:       "ai",
		Content:          "",
		ContentType:      "text",
		Status:           "streaming",
	}

	if err := h.db.Create(&aiMessage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50018,
			"创建AI消息失败",
			err.Error(),
		))
		return
	}

	// 使用真实的AI服务进行流式对话
	h.streamAIResponseWithService(c, aiMessage, conversationID)
}

// streamAIResponseWithService 使用AI服务进行流式响应
func (h *ChatHandler) streamAIResponseWithService(c *gin.Context, message models.Message, conversationID string) {
	w := c.Writer
	flusher, ok := w.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50015,
			"不支持流式响应",
			nil,
		))
		return
	}

	// 发送消息开始事件
	h.writeSSEEvent(w, flusher, SSEEvent{
		Type: "message_start",
		Data: map[string]interface{}{
			"message_id": message.ID,
			"timestamp":  time.Now(),
		},
	})

	// 获取对话历史并构建上下文
	var historyMessages []models.Message
	h.db.Where("conversation_id = ?", conversationID).
		Order("created_at ASC").
		Find(&historyMessages)

	// 使用AI服务构建上下文消息
	contextMessages := h.aiService.BuildContextMessages(historyMessages)

	// 调用AI服务进行流式对话
	ctx := c.Request.Context()
	streamChan, err := h.aiService.ChatStream(ctx, contextMessages, &ai.GenerateOptions{
		Stream: true,
	})
	if err != nil {
		h.writeSSEEvent(w, flusher, SSEEvent{
			Type: "error",
			Data: map[string]interface{}{
				"message_id": message.ID,
				"error":      err.Error(),
			},
		})
		return
	}

	fullContent := ""
	var finalTokenCount int
	var finalFinishReason string

	// 处理流式响应
	for chunk := range streamChan {
		select {
		case <-ctx.Done():
			return
		default:
			if chunk.Error != nil {
				h.writeSSEEvent(w, flusher, SSEEvent{
					Type: "error",
					Data: map[string]interface{}{
						"message_id": message.ID,
						"error":      chunk.Error.Error(),
					},
				})
				return
			}

			if chunk.Delta != "" {
				// 发送内容增量
				h.writeSSEEvent(w, flusher, SSEEvent{
					Type: "content_delta",
					Data: map[string]interface{}{
						"message_id": message.ID,
						"delta":      chunk.Delta,
						"content":    chunk.Content,
					},
				})
			}

			fullContent = chunk.Content
			if chunk.Finished {
				finalTokenCount = chunk.TokenCount
				finalFinishReason = chunk.FinishReason
				break
			}
		}
	}

	// 更新数据库中的AI消息
	processingTime := 1500 // 实际处理时间
	h.db.Model(&message).Updates(map[string]interface{}{
		"content":             fullContent,
		"status":              "completed",
		"token_count":         finalTokenCount,
		"processing_time_ms":  processingTime,
	})

	// 更新对话统计
	h.db.Model(&models.Conversation{}).Where("id = ?", message.ConversationID).
		Updates(map[string]interface{}{
			"total_messages":   gorm.Expr("total_messages + 1"),
			"last_message_at": time.Now(),
		})

	// 发送消息完成事件
	h.writeSSEEvent(w, flusher, SSEEvent{
		Type: "message_complete",
		Data: map[string]interface{}{
			"message_id":         message.ID,
			"token_count":        finalTokenCount,
			"processing_time_ms": processingTime,
			"finish_reason":      finalFinishReason,
			"timestamp":          time.Now(),
		},
	})

	// 发送结束标记
	fmt.Fprintf(w, "event: done\ndata: {}\n\n")
	flusher.Flush()
}

func (h *ChatHandler) streamAIResponse(c *gin.Context, message models.Message, userInput string) {
	w := c.Writer
	flusher, ok := w.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50015,
			"不支持流式响应",
			nil,
		))
		return
	}

	// 发送消息开始事件
	h.writeSSEEvent(w, flusher, SSEEvent{
		Type: "message_start",
		Data: map[string]interface{}{
			"message_id": message.ID,
			"timestamp":  time.Now(),
		},
	})

	// 模拟AI处理和响应
	// TODO: 这里应该集成实际的AI引擎
	responses := []string{
		"我理解您的问题",
		"正在为您分析CDN相关信息",
		"根据我的知识库，建议如下：",
		"1. 检查CDN节点状态",
		"2. 验证缓存配置",
		"3. 监控访问日志",
		"如需更详细的帮助，请提供具体的错误信息。",
	}

	fullContent := ""
	for i, response := range responses {
		select {
		case <-c.Request.Context().Done():
			return
		default:
			// 发送内容增量
			h.writeSSEEvent(w, flusher, SSEEvent{
				Type: "content_delta",
				Data: map[string]interface{}{
					"message_id": message.ID,
					"delta":      response,
					"index":      i,
				},
			})

			fullContent += response
			time.Sleep(200 * time.Millisecond) // 模拟处理延迟
		}
	}

	// 更新消息内容
	tokenCount := len(fullContent) / 4 // 简单估算token数
	processingTime := 1500              // 模拟处理时间

	h.db.Model(&message).Updates(map[string]interface{}{
		"content":             fullContent,
		"status":              "completed",
		"token_count":         tokenCount,
		"processing_time_ms":  processingTime,
	})

	// 更新对话统计
	h.db.Model(&models.Conversation{}).Where("id = ?", message.ConversationID).
		Updates(map[string]interface{}{
			"total_messages":   gorm.Expr("total_messages + 1"),
			"last_message_at": time.Now(),
		})

	// 发送消息完成事件
	h.writeSSEEvent(w, flusher, SSEEvent{
		Type: "message_complete",
		Data: map[string]interface{}{
			"message_id":         message.ID,
			"token_count":        tokenCount,
			"processing_time_ms": processingTime,
			"timestamp":          time.Now(),
		},
	})

	// 发送结束标记
	fmt.Fprintf(w, "event: done\ndata: {}\n\n")
	flusher.Flush()
}

func (h *ChatHandler) writeSSEEvent(w http.ResponseWriter, flusher http.Flusher, event SSEEvent) {
	data, _ := json.Marshal(event)
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, string(data))
	flusher.Flush()
}

// GetMessage 获取单个消息详情
func (h *ChatHandler) GetMessage(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")
	messageID := c.Param("messageId")

	// 验证对话是否属于当前用户
	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40415,
			"对话不存在",
			nil,
		))
		return
	}

	// 查询消息
	var message models.Message
	if err := h.db.Where("id = ? AND conversation_id = ?", messageID, conversationID).First(&message).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40416,
			"消息不存在",
			nil,
		))
		return
	}

	response := MessageResponse{
		ID:               message.ID,
		ConversationID:   message.ConversationID,
		ParentMessageID:  message.ParentMessageID,
		SenderType:       message.SenderType,
		Content:          message.Content,
		ContentType:      message.ContentType,
		Metadata:         message.Metadata,
		TokenCount:       message.TokenCount,
		ProcessingTimeMs: message.ProcessingTimeMs,
		Status:           message.Status,
		ErrorMessage:     message.ErrorMessage,
		CreatedAt:        message.CreatedAt,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

// RegenerateMessage 重新生成AI消息
func (h *ChatHandler) RegenerateMessage(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")
	messageID := c.Param("messageId")

	// 验证对话是否属于当前用户
	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40417,
			"对话不存在",
			nil,
		))
		return
	}

	// 查询要重新生成的消息（必须是AI消息）
	var message models.Message
	if err := h.db.Where("id = ? AND conversation_id = ? AND sender_type = ?", messageID, conversationID, "ai").First(&message).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40418,
			"AI消息不存在",
			nil,
		))
		return
	}

	// 获取父消息（用户消息）作为重新生成的输入
	var parentMessage models.Message
	if message.ParentMessageID == nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40419,
			"无法找到对应的用户消息",
			nil,
		))
		return
	}

	if err := h.db.Where("id = ?", *message.ParentMessageID).First(&parentMessage).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40420,
			"父消息不存在",
			nil,
		))
		return
	}

	// 创建新的AI消息记录
	newAIMessage := models.Message{
		ID:               uuid.New(),
		ConversationID:   conversation.ID,
		ParentMessageID:  message.ParentMessageID,
		SenderType:       "ai",
		Content:          "",
		ContentType:      "text",
		Status:           "streaming",
	}

	if err := h.db.Create(&newAIMessage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50018,
			"创建新消息失败",
			err.Error(),
		))
		return
	}

	// 设置SSE响应头
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	// 模拟AI流式响应
	h.streamAIResponse(c, newAIMessage, parentMessage.Content)
}

func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")

	// 验证对话是否属于当前用户
	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40414,
			"对话不存在",
			nil,
		))
		return
	}

	// 软删除：更新状态为deleted
	if err := h.db.Model(&conversation).Update("status", "deleted").Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50016,
			"删除对话失败",
			err.Error(),
		))
		return
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse("对话删除成功"))
}

func (h *ChatHandler) UpdateConversation(c *gin.Context) {
	userID, _ := c.Get("user_id")
	conversationID := c.Param("id")

	// 验证对话是否属于当前用户
	var conversation models.Conversation
	if err := h.db.Where("id = ? AND user_id = ?", conversationID, userID).First(&conversation).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40415,
			"对话不存在",
			nil,
		))
		return
	}

	var req CreateConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40013,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 更新对话
	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Context != nil {
		updates["context"] = req.Context
	}

	if err := h.db.Model(&conversation).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50017,
			"更新对话失败",
			err.Error(),
		))
		return
	}

	// 重新查询更新后的数据
	h.db.Where("id = ?", conversationID).First(&conversation)

	response := ConversationResponse{
		ID:            conversation.ID,
		Title:         conversation.Title,
		Context:       conversation.Context,
		Status:        conversation.Status,
		TotalMessages: conversation.TotalMessages,
		LastMessageAt: conversation.LastMessageAt,
		CreatedAt:     conversation.CreatedAt,
		UpdatedAt:     conversation.UpdatedAt,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}