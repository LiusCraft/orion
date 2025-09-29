package ai

import (
	"context"
	"fmt"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
	"github.com/cloudwego/eino-ext/components/model/claude"
	"github.com/cloudwego/eino-ext/components/model/openai"

	"github.com/cdnagent/cdnagent/internal/config"
	dbmodels "github.com/cdnagent/cdnagent/internal/database/models"
)

// AIService AI服务接口
type AIService struct {
	chatModel  model.ChatModel
	config     *config.LLMConfig
}

// ChatMessage 标准化的聊天消息格式
type ChatMessage struct {
	Role     string                 `json:"role"`    // system, user, assistant
	Content  string                 `json:"content"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
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
	Content      string                 `json:"content"`   // 完整内容
	Delta        string                 `json:"delta"`     // 增量内容
	Finished     bool                   `json:"finished"`  // 是否结束
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
	var chatModel model.ChatModel
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
func createClaudeModel(config *config.LLMConfig) (model.ChatModel, error) {
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
func createOpenAIModel(config *config.LLMConfig) (model.ChatModel, error) {
	openaiConfig := &openai.ChatModelConfig{
		APIKey:    config.APIKey,
		Model:     config.Model,
		BaseURL:   config.BaseURL,
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
					ID:      chunkID,
					Content: fullContent,
					Delta:   delta,
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
			Role:    role,
			Content: msg.Content,
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