package ai

import (
	"context"
	"testing"

	"github.com/liusCraft/orion/internal/config"
)

func TestService(t *testing.T) {
	cfg := &config.LLMConfig{
		Provider:    "openai",
		Model:       "claude-4.0-sonnet",
		APIKey:      "sk-5355eadae40825702a015de58478b323378ed8455e6e19045938bd63abed9f7e",
		BaseURL:     "https://openai.qiniu.com/v1",
		Temperature: 0.7,
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
