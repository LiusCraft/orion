package ai

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/cloudwego/eino-ext/components/model/claude"
	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"

	"github.com/liusCraft/orion/internal/config"
	"github.com/liusCraft/orion/internal/constants"
	dbmodels "github.com/liusCraft/orion/internal/database/models"
)

// AIService AI服务接口
type AIService struct {
	chatModel model.ToolCallingChatModel
	config    *config.LLMConfig
}

// ChatMessage 标准化的聊天消息格式
type ChatMessage struct {
	Role     string                 `json:"role"` // system, user, assistant
	Content  string                 `json:"content"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
	// 用于工具消息：OpenAI工具调用需要tool消息携带tool_call_id
	ToolCallID string `json:"tool_call_id,omitempty"`
}

// ChatResponse 聊天响应
type ChatResponse struct {
	Content      string                 `json:"content"`
	TokenCount   int                    `json:"token_count,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	FinishReason string                 `json:"finish_reason,omitempty"`
}

// StreamChunk 流式响应块
type StreamChunk struct {
	ID           string                 `json:"id"`
	Content      string                 `json:"content"`  // 完整内容
	Delta        string                 `json:"delta"`    // 增量内容
	Finished     bool                   `json:"finished"` // 是否结束
	TokenCount   int                    `json:"token_count,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	Error        error                  `json:"error,omitempty"`
	FinishReason string                 `json:"finish_reason,omitempty"`
}

// GenerateOptions 生成选项
type GenerateOptions struct {
	Temperature *float64 `json:"temperature,omitempty"`
	MaxTokens   *int     `json:"max_tokens,omitempty"`
	TopK        *int     `json:"top_k,omitempty"`
	TopP        *float64 `json:"top_p,omitempty"`
	Stream      bool     `json:"stream"`
}

// NewAIService 创建AI服务实例
func NewAIService(config *config.LLMConfig) (*AIService, error) {
	var chatModel model.ToolCallingChatModel
	var err error

	switch config.Provider {
	case "claude":
		chatModel, err = createClaudeModel(config)
	case "openai":
		chatModel, err = createOpenAIModel(config)
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s", config.Provider)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create chat model: %w", err)
	}

	return &AIService{
		chatModel: chatModel,
		config:    config,
	}, nil
}

// createClaudeModel 创建Claude模型
func createClaudeModel(config *config.LLMConfig) (model.ToolCallingChatModel, error) {
	claudeConfig := &claude.Config{
		APIKey:    config.APIKey,
		Model:     config.Model,
		MaxTokens: config.MaxTokens,
	}

	if config.BaseURL != "" {
		claudeConfig.BaseURL = &config.BaseURL
	}

	if config.Temperature > 0 {
		temp := float32(config.Temperature)
		claudeConfig.Temperature = &temp
	}

	if config.TopP > 0 {
		topP := float32(config.TopP)
		claudeConfig.TopP = &topP
	}

	if config.TopK > 0 {
		topK := int32(config.TopK)
		claudeConfig.TopK = &topK
	}

	chatModel, err := claude.NewChatModel(context.Background(), claudeConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create Claude model: %w", err)
	}

	return chatModel, nil
}

// createOpenAIModel 创建OpenAI模型
func createOpenAIModel(config *config.LLMConfig) (model.ToolCallingChatModel, error) {
	openaiConfig := &openai.ChatModelConfig{
		APIKey:  config.APIKey,
		Model:   config.Model,
		BaseURL: config.BaseURL,
	}

	if config.MaxTokens > 0 {
		openaiConfig.MaxTokens = &config.MaxTokens
	}

	if config.Temperature > 0 {
		temp := float32(config.Temperature)
		openaiConfig.Temperature = &temp
	}

	if config.TopP > 0 {
		topP := float32(config.TopP)
		openaiConfig.TopP = &topP
	}

	chatModel, err := openai.NewChatModel(context.Background(), openaiConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAI model: %w", err)
	}

	return chatModel, nil
}

// Chat 同步对话
func (s *AIService) Chat(ctx context.Context, messages []ChatMessage, opts *GenerateOptions) (*ChatResponse, error) {
	// 转换消息格式
	einoMessages := s.convertToEinoMessages(messages)

	// 构建选项
	modelOpts := s.buildModelOptions(opts)

	// 调用模型
	response, err := s.chatModel.Generate(ctx, einoMessages, modelOpts...)
	if err != nil {
		return nil, fmt.Errorf("chat model generate error: %w", err)
	}

	// 从ResponseMeta获取信息
	var tokenCount int
	var finishReason string
	if response.ResponseMeta != nil {
		if response.ResponseMeta.Usage != nil {
			tokenCount = response.ResponseMeta.Usage.TotalTokens
		}
		finishReason = response.ResponseMeta.FinishReason
	}

	return &ChatResponse{
		Content:      response.Content,
		TokenCount:   tokenCount,
		FinishReason: finishReason,
		Metadata: map[string]interface{}{
			"model": s.config.Model,
			"usage": response.ResponseMeta,
		},
	}, nil
}

// GenerateMessage 低层封装：返回完整的schema.Message，支持注入Tools
func (s *AIService) GenerateMessage(ctx context.Context, messages []ChatMessage, tools []*schema.ToolInfo, opts *GenerateOptions) (*schema.Message, error) {
	einoMessages := s.convertToEinoMessages(messages)
	modelOpts := s.buildModelOptions(opts)
	if len(tools) > 0 {
		modelOpts = append(modelOpts, model.WithTools(tools))
	}
	msg, err := s.chatModel.Generate(ctx, einoMessages, modelOpts...)
	if err != nil {
		return nil, fmt.Errorf("chat model generate error: %w", err)
	}
	return msg, nil
}

// GenerateEinoMessage 直接使用eino消息，便于携带tool_calls
func (s *AIService) GenerateEinoMessage(ctx context.Context, einoMessages []*schema.Message, tools []*schema.ToolInfo, opts *GenerateOptions) (*schema.Message, error) {
	modelOpts := s.buildModelOptions(opts)
	if len(tools) > 0 {
		modelOpts = append(modelOpts, model.WithTools(tools))
	}
	msg, err := s.chatModel.Generate(ctx, einoMessages, modelOpts...)
	if err != nil {
		return nil, fmt.Errorf("chat model generate error: %w", err)
	}
	return msg, nil
}

// ChatStreamEino 使用eino消息进行流式对话
func (s *AIService) ChatStreamEino(ctx context.Context, einoMessages []*schema.Message, opts *GenerateOptions) (<-chan StreamChunk, error) {
	modelOpts := s.buildModelOptions(opts)
	streamReader, err := s.chatModel.Stream(ctx, einoMessages, modelOpts...)
	if err != nil {
		return nil, fmt.Errorf("chat model stream error: %w", err)
	}
	chunkChan := make(chan StreamChunk, 10)
	go func() {
		defer close(chunkChan)
		defer streamReader.Close()
		fullContent := ""
		chunkID := fmt.Sprintf("chat-%d", time.Now().UnixNano())
		for {
			select {
			case <-ctx.Done():
				chunkChan <- StreamChunk{ID: chunkID, Content: fullContent, Finished: true, Error: ctx.Err()}
				return
			default:
				chunk, err := streamReader.Recv()
				if err != nil {
					if err.Error() == "EOF" || err.Error() == "stream finished" {
						var tokenCount int
						var finishReason string
						if chunk != nil && chunk.ResponseMeta != nil {
							if chunk.ResponseMeta.Usage != nil {
								tokenCount = chunk.ResponseMeta.Usage.TotalTokens
							}
							finishReason = chunk.ResponseMeta.FinishReason
						}
						chunkChan <- StreamChunk{ID: chunkID, Content: fullContent, Finished: true, TokenCount: tokenCount, FinishReason: finishReason}
						return
					}
					chunkChan <- StreamChunk{ID: chunkID, Content: fullContent, Finished: true, Error: err}
					return
				}
				if chunk == nil {
					continue
				}
				delta := chunk.Content
				fullContent += delta
				chunkChan <- StreamChunk{ID: chunkID, Content: fullContent, Delta: delta, Finished: false}
			}
		}
	}()
	return chunkChan, nil
}

// ToEinoMessages 导出转换函数，便于外部直接构造eino上下文
func (s *AIService) ToEinoMessages(messages []ChatMessage) []*schema.Message {
	return s.convertToEinoMessages(messages)
}

// ChatStream 流式对话
func (s *AIService) ChatStream(ctx context.Context, messages []ChatMessage, opts *GenerateOptions) (<-chan StreamChunk, error) {
	// 转换消息格式
	einoMessages := s.convertToEinoMessages(messages)

	// 构建选项
	modelOpts := s.buildModelOptions(opts)

	// 调用流式模型
	streamReader, err := s.chatModel.Stream(ctx, einoMessages, modelOpts...)
	if err != nil {
		return nil, fmt.Errorf("chat model stream error: %w", err)
	}

	// 创建输出通道
	chunkChan := make(chan StreamChunk, 10)

	go func() {
		defer close(chunkChan)
		defer streamReader.Close()

		fullContent := ""
		chunkID := fmt.Sprintf("chat-%d", time.Now().UnixNano())

		for {
			select {
			case <-ctx.Done():
				chunkChan <- StreamChunk{
					ID:       chunkID,
					Content:  fullContent,
					Finished: true,
					Error:    ctx.Err(),
				}
				return

			default:
				chunk, err := streamReader.Recv()
				if err != nil {
					if err.Error() == "EOF" || err.Error() == "stream finished" {
						// 流结束
						var tokenCount int
						var finishReason string
						if chunk != nil && chunk.ResponseMeta != nil {
							if chunk.ResponseMeta.Usage != nil {
								tokenCount = chunk.ResponseMeta.Usage.TotalTokens
							}
							finishReason = chunk.ResponseMeta.FinishReason
						}

						chunkChan <- StreamChunk{
							ID:           chunkID,
							Content:      fullContent,
							Finished:     true,
							TokenCount:   tokenCount,
							FinishReason: finishReason,
						}
						return
					}
					// 错误
					chunkChan <- StreamChunk{
						ID:       chunkID,
						Content:  fullContent,
						Finished: true,
						Error:    err,
					}
					return
				}

				// 检查chunk是否为nil
				if chunk == nil {
					continue
				}

				// 正常块
				delta := chunk.Content
				fullContent += delta

				chunkChan <- StreamChunk{
					ID:       chunkID,
					Content:  fullContent,
					Delta:    delta,
					Finished: false,
				}
			}
		}
	}()

	return chunkChan, nil
}

// HealthCheck 健康检查
func (s *AIService) HealthCheck(ctx context.Context) error {
	testMessages := []ChatMessage{
		{
			Role:    "user",
			Content: "hello",
		},
	}

	// 设置较短的超时时间
	healthCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	_, err := s.Chat(healthCtx, testMessages, &GenerateOptions{
		MaxTokens: intPtr(10),
	})

	return err
}

// BuildContextMessages 构建包含系统提示词和历史的完整上下文
func (s *AIService) BuildContextMessages(historyMessages []dbmodels.Message) []ChatMessage {
	var messages []ChatMessage

	// 添加系统提示词
	if s.config.SystemPrompt != "" {
		messages = append(messages, ChatMessage{
			Role:    "system",
			Content: s.config.SystemPrompt,
		})
	}

	// 添加历史消息（限制数量）
	maxHistory := 20 // 限制历史消息数量
	startIdx := 0
	if len(historyMessages) > maxHistory {
		startIdx = len(historyMessages) - maxHistory
	}

	for i := startIdx; i < len(historyMessages); i++ {
		msg := historyMessages[i]
		role := msg.SenderType
		if role == "ai" {
			role = "assistant" // 统一转换为assistant
		}
		messages = append(messages, ChatMessage{
			Role:    role,
			Content: msg.Content,
		})
	}

	return messages
}

// convertToEinoMessages 转换为Eino消息格式
func (s *AIService) convertToEinoMessages(messages []ChatMessage) []*schema.Message {
	var einoMessages []*schema.Message

	for _, msg := range messages {
		var role schema.RoleType
		switch msg.Role {
		case "system":
			role = schema.System
		case "user":
			role = schema.User
		case "assistant", "ai":
			role = schema.Assistant
		case "tool":
			role = schema.Tool
		default:
			role = schema.User // 默认为用户消息
		}

		einoMessages = append(einoMessages, &schema.Message{
			Role:       role,
			Content:    msg.Content,
			ToolCallID: msg.ToolCallID,
		})
	}

	return einoMessages
}

// buildModelOptions 构建模型选项
func (s *AIService) buildModelOptions(opts *GenerateOptions) []model.Option {
	var modelOpts []model.Option

	// 使用传入的选项或配置默认值
	temperature := s.config.Temperature
	if opts != nil && opts.Temperature != nil {
		temperature = *opts.Temperature
	}
	if temperature > 0 {
		modelOpts = append(modelOpts, model.WithTemperature(float32(temperature)))
	}

	maxTokens := s.config.MaxTokens
	if opts != nil && opts.MaxTokens != nil {
		maxTokens = *opts.MaxTokens
	}
	if maxTokens > 0 {
		modelOpts = append(modelOpts, model.WithMaxTokens(maxTokens))
	}

	return modelOpts
}

// getTokenCount 从TokenUsage中获取token数量 (保留作为工具函数)
func getTokenCount(usage *schema.TokenUsage) int {
	if usage == nil {
		return 0
	}
	return usage.TotalTokens
}

// intPtr 创建int指针
func intPtr(i int) *int {
	return &i
}

// maskAPIKey 隐藏API密钥的敏感部分
func maskAPIKey(apiKey string) string {
	if apiKey == "" {
		return "<empty>"
	}
	if len(apiKey) <= 8 {
		return "***"
	}
	return apiKey[:4] + "..." + apiKey[len(apiKey)-4:]
}

// GenerateTitle 根据用户消息与AI回复生成简短标题（中文，简洁，无标点）
func (s *AIService) GenerateTitle(ctx context.Context, userText, aiText string) (string, error) {
	// 兜底：用户内容截断
	fallback := func() string {
		rt := []rune(userText)
		if len(rt) == 0 {
			return constants.DefaultConversationTitle
		}
		if len(rt) > 16 {
			rt = rt[:16]
		}
		return string(rt)
	}

	// 构造提示词
	sys := "你是对话标题助手。请根据给定的用户问题和助理回答，生成一个简短的中文标题，要求：6-16个字，概括主题，避免客套话；不要包含标点、书名号或引号；只输出标题文本。"
	prompt := "用户提问：\n" + userText + "\n\n助理回答：\n" + aiText + "\n\n现在只输出一个简短中文标题。"

	// 最多给很少的tokens，保证快速返回
	maxTokens := 24
	resp, err := s.Chat(ctx, []ChatMessage{
		{Role: "system", Content: sys},
		{Role: "user", Content: prompt},
	}, &GenerateOptions{MaxTokens: &maxTokens})
	if err != nil {
		return fallback(), err
	}

	title := resp.Content
	// 清理常见符号与空白
	replacer := strings.NewReplacer(
		"\n", "", "\r", "", "\t", "",
		"\"", "", "'", "", "“", "", "”", "", "‘", "", "’", "",
		"【", "", "】", "", "（", "", "）", "", "(", "", ")", "",
		"[", "", "]", "", "{", "", "}", "",
		"。", "", "，", "", ",", "", "！", "", "?", "", "？", "",
		"：", "", ":", "", "；", "", ";", "", "、", "", "—", "", "-", "",
	)
	title = replacer.Replace(title)
	title = strings.TrimSpace(title)
	if title == "" {
		return fallback(), nil
	}

	// 限长
	rt := []rune(title)
	if len(rt) > 20 {
		rt = rt[:20]
	}
	return string(rt), nil
}

// end
