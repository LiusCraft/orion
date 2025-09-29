package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Redis    RedisConfig    `mapstructure:"redis"`
	AI       AIConfig       `mapstructure:"ai"`
	JWT      JWTConfig      `mapstructure:"jwt"`
	Tools    ToolsConfig    `mapstructure:"tools"`
}

type ServerConfig struct {
	Host         string `mapstructure:"host"`
	Port         string `mapstructure:"port"`
	Mode         string `mapstructure:"mode"` // debug, release
	ReadTimeout  int    `mapstructure:"read_timeout"`
	WriteTimeout int    `mapstructure:"write_timeout"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
	SSLMode  string `mapstructure:"sslmode"`
	TimeZone string `mapstructure:"timezone"`
}

type RedisConfig struct {
	Host     string `mapstructure:"host"`
	Port     string `mapstructure:"port"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
}

type AIConfig struct {
	LLM       LLMConfig       `mapstructure:"llm"`
	RAG       RAGConfig       `mapstructure:"rag"`
	Agent     AgentConfig     `mapstructure:"agent"`
	Embedding EmbeddingConfig `mapstructure:"embedding"`
}

type LLMConfig struct {
	Provider    string  `mapstructure:"provider"`     // openai, qwen
	Model       string  `mapstructure:"model"`        // gpt-4, qwen-plus
	APIKey      string  `mapstructure:"api_key"`
	BaseURL     string  `mapstructure:"base_url"`
	Temperature float64 `mapstructure:"temperature"`
	MaxTokens   int     `mapstructure:"max_tokens"`
	Timeout     int     `mapstructure:"timeout"`
}

type RAGConfig struct {
	TopK           int     `mapstructure:"top_k"`
	ScoreThreshold float64 `mapstructure:"score_threshold"`
	VectorWeight   float64 `mapstructure:"vector_weight"`
	TextWeight     float64 `mapstructure:"text_weight"`
	HybridEnabled  bool    `mapstructure:"hybrid_enabled"`
}

type AgentConfig struct {
	MaxIterations   int  `mapstructure:"max_iterations"`
	ThinkingEnabled bool `mapstructure:"thinking_enabled"`
	MemoryEnabled   bool `mapstructure:"memory_enabled"`
	MemoryLength    int  `mapstructure:"memory_length"`
}

type EmbeddingConfig struct {
	Provider     string `mapstructure:"provider"`     // openai, local
	Model        string `mapstructure:"model"`        // text-embedding-ada-002
	ChunkSize    int    `mapstructure:"chunk_size"`
	ChunkOverlap int    `mapstructure:"chunk_overlap"`
	BatchSize    int    `mapstructure:"batch_size"`
}

type JWTConfig struct {
	Secret     string `mapstructure:"secret"`
	ExpiresIn  int    `mapstructure:"expires_in"`  // hours
	RefreshIn  int    `mapstructure:"refresh_in"`  // hours
	Issuer     string `mapstructure:"issuer"`
}

type ToolsConfig struct {
	Timeout       int                    `mapstructure:"timeout"`
	MaxConcurrent int                    `mapstructure:"max_concurrent"`
	Grafana       GrafanaConfig          `mapstructure:"grafana"`
	Logs          LogsConfig             `mapstructure:"logs"`
	CDN           CDNConfig              `mapstructure:"cdn"`
}

type GrafanaConfig struct {
	BaseURL string `mapstructure:"base_url"`
	APIKey  string `mapstructure:"api_key"`
	Enabled bool   `mapstructure:"enabled"`
}

type LogsConfig struct {
	ElasticURL string `mapstructure:"elastic_url"`
	Username   string `mapstructure:"username"`
	Password   string `mapstructure:"password"`
	Enabled    bool   `mapstructure:"enabled"`
}

type CDNConfig struct {
	BaseURL string `mapstructure:"base_url"`
	APIKey  string `mapstructure:"api_key"`
	Enabled bool   `mapstructure:"enabled"`
}

var GlobalConfig *Config

func Load() error {
	viper.SetConfigName("config")
	viper.SetConfigType("json")
	viper.AddConfigPath("./internal/config")
	viper.AddConfigPath("./config")
	viper.AddConfigPath(".")

	// 环境变量支持
	viper.AutomaticEnv()
	viper.SetEnvPrefix("CDNAGENT")

	// 设置默认值
	setDefaults()

	// 读取配置文件
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// 配置文件未找到，使用默认值和环境变量
		} else {
			return fmt.Errorf("读取配置文件失败: %w", err)
		}
	}

	// 解析配置
	config := &Config{}
	if err := viper.Unmarshal(config); err != nil {
		return fmt.Errorf("解析配置失败: %w", err)
	}

	// 从环境变量覆盖敏感信息
	if dbPassword := os.Getenv("CDNAGENT_DATABASE_PASSWORD"); dbPassword != "" {
		config.Database.Password = dbPassword
	}
	if apiKey := os.Getenv("CDNAGENT_AI_LLM_API_KEY"); apiKey != "" {
		config.AI.LLM.APIKey = apiKey
	}
	if jwtSecret := os.Getenv("CDNAGENT_JWT_SECRET"); jwtSecret != "" {
		config.JWT.Secret = jwtSecret
	}

	GlobalConfig = config
	return nil
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("server.read_timeout", 30)
	viper.SetDefault("server.write_timeout", 30)

	// Database defaults
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", "5432")
	viper.SetDefault("database.user", "postgres")
	viper.SetDefault("database.dbname", "cdnagent")
	viper.SetDefault("database.sslmode", "disable")
	viper.SetDefault("database.timezone", "UTC")

	// Redis defaults
	viper.SetDefault("redis.host", "localhost")
	viper.SetDefault("redis.port", "6379")
	viper.SetDefault("redis.db", 0)

	// AI defaults
	viper.SetDefault("ai.llm.provider", "openai")
	viper.SetDefault("ai.llm.model", "gpt-4")
	viper.SetDefault("ai.llm.temperature", 0.7)
	viper.SetDefault("ai.llm.max_tokens", 2000)
	viper.SetDefault("ai.llm.timeout", 60)

	// RAG defaults
	viper.SetDefault("ai.rag.top_k", 10)
	viper.SetDefault("ai.rag.score_threshold", 0.7)
	viper.SetDefault("ai.rag.vector_weight", 0.7)
	viper.SetDefault("ai.rag.text_weight", 0.3)
	viper.SetDefault("ai.rag.hybrid_enabled", true)

	// Agent defaults
	viper.SetDefault("ai.agent.max_iterations", 10)
	viper.SetDefault("ai.agent.thinking_enabled", true)
	viper.SetDefault("ai.agent.memory_enabled", true)
	viper.SetDefault("ai.agent.memory_length", 50)

	// Embedding defaults
	viper.SetDefault("ai.embedding.provider", "openai")
	viper.SetDefault("ai.embedding.model", "text-embedding-ada-002")
	viper.SetDefault("ai.embedding.chunk_size", 1000)
	viper.SetDefault("ai.embedding.chunk_overlap", 200)
	viper.SetDefault("ai.embedding.batch_size", 10)

	// JWT defaults
	viper.SetDefault("jwt.expires_in", 24)  // 24 hours
	viper.SetDefault("jwt.refresh_in", 168) // 7 days
	viper.SetDefault("jwt.issuer", "cdnagent")

	// Tools defaults
	viper.SetDefault("tools.timeout", 30)
	viper.SetDefault("tools.max_concurrent", 5)
	viper.SetDefault("tools.grafana.enabled", false)
	viper.SetDefault("tools.logs.enabled", false)
	viper.SetDefault("tools.cdn.enabled", false)
}