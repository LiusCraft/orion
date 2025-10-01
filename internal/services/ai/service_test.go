package ai

import (
	"context"
	"os"
	"testing"

	"github.com/liusCraft/orion/internal/config"
)

func TestService(t *testing.T) {
	llmProvider := os.Getenv("LLM_PROVIDER")
	llmApiKey := os.Getenv("LLM_API_KEY")
	llmBaseURL := os.Getenv("LLM_BASE_URL")
	llmModel := os.Getenv("LLM_MODEL")
	if llmProvider == "" {
		t.Skip("LLM_PROVIDER not set")
	}
	if llmApiKey == "" {
		t.Skip("LLM_API_KEY not set")
	}
	if llmBaseURL == "" {
		t.Skip("LLM_BASE_URL not set")
	}
	if llmModel == "" {
		t.Skip("LLM_MODEL not set")
	}
	cfg := &config.LLMConfig{
		Provider:    llmProvider,
		Model:       llmModel,
		APIKey:      llmApiKey,
		BaseURL:     llmBaseURL,
		Temperature: 0.5,
		MaxTokens:   2000,
	}
	srv, err := NewAIService(cfg)
	if err != nil {
		t.Fatal(err)
	}
	chatResp, err := srv.Chat(context.TODO(), []ChatMessage{{Role: "user", Content: "你好"}}, nil)
	if err != nil {
		t.Fatal(err)
	}

	t.Log(chatResp.Content)
}
