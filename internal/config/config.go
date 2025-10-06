package config

import (
	"fmt"
	"os"
	"reflect"
	"regexp"

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
	// SSE 心跳间隔（秒），用于保持长连接活跃
	SSEHeartbeat int `mapstructure:"sse_heartbeat"`
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
	Provider    string  `mapstructure:"provider"` // openai, claude, qwen
	Model       string  `mapstructure:"model"`    // gpt-4, claude-3-sonnet-20240229, qwen-plus
	APIKey      string  `mapstructure:"api_key"`
	BaseURL     string  `mapstructure:"base_url"`
	Temperature float64 `mapstructure:"temperature"`
	MaxTokens   int     `mapstructure:"max_tokens"`
	Timeout     int     `mapstructure:"timeout"`

	// Claude特有参数
	TopK int     `mapstructure:"top_k"`
	TopP float64 `mapstructure:"top_p"`

	// 系统提示词配置
	SystemPrompt string `mapstructure:"system_prompt"`

	// 重试配置
	RetryCount int `mapstructure:"retry_count"`
	RetryDelay int `mapstructure:"retry_delay"` // seconds
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
	// 规划阶段：工具调用最多轮数（非流式），默认1轮即可
	ToolPlanMaxIter int `mapstructure:"tool_plan_max_iter"`
	// 是否根据用户意图判断再启用工具规划（简单关键词启发式）
	ToolIntentEnabled bool `mapstructure:"tool_intent_enabled"`
}

type EmbeddingConfig struct {
	Provider     string `mapstructure:"provider"` // openai, local
	Model        string `mapstructure:"model"`    // text-embedding-ada-002
	ChunkSize    int    `mapstructure:"chunk_size"`
	ChunkOverlap int    `mapstructure:"chunk_overlap"`
	BatchSize    int    `mapstructure:"batch_size"`
}

type JWTConfig struct {
	Secret    string `mapstructure:"secret"`
	ExpiresIn int    `mapstructure:"expires_in"` // hours
	RefreshIn int    `mapstructure:"refresh_in"` // hours
	Issuer    string `mapstructure:"issuer"`
}

type ToolsConfig struct {
	Timeout       int           `mapstructure:"timeout"`
	MaxConcurrent int           `mapstructure:"max_concurrent"`
	Grafana       GrafanaConfig `mapstructure:"grafana"`
	Logs          LogsConfig    `mapstructure:"logs"`
	CDN           CDNConfig     `mapstructure:"cdn"`
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

	// 展开字符串中的环境变量占位符，如 ${VAR}
	expandEnvPlaceholders(config)

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

// 支持占位符格式：${VAR} 或 ${VAR:-default}
var envPlaceholderRe = regexp.MustCompile(`\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-(.*?))?\}`)

func expandEnvPlaceholders(cfg *Config) {
	if cfg == nil {
		return
	}
	replacePlaceholders(reflect.ValueOf(cfg))
}

func replacePlaceholders(v reflect.Value) {
	if !v.IsValid() {
		return
	}
	switch v.Kind() {
	case reflect.Ptr:
		if !v.IsNil() {
			replacePlaceholders(v.Elem())
		}
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			f := v.Field(i)
			replacePlaceholders(f)
		}
	case reflect.Slice, reflect.Array:
		for i := 0; i < v.Len(); i++ {
			replacePlaceholders(v.Index(i))
		}
	case reflect.Map:
		for _, key := range v.MapKeys() {
			val := v.MapIndex(key)
			replacePlaceholders(val)
		}
	case reflect.String:
		if v.CanSet() {
			s := v.String()
			replaced := envPlaceholderRe.ReplaceAllStringFunc(s, func(m string) string {
				sub := envPlaceholderRe.FindStringSubmatch(m)
				if len(sub) >= 2 {
					name := sub[1]
					def := ""
					if len(sub) >= 3 {
						def = sub[2]
					}
					val := os.Getenv(name)
					if val == "" {
						val = def
					}
					return val
				}
				return m
			})
			if s != replaced {
				v.SetString(replaced)
			}
		}
	}
}

func setDefaults() {
	// Server defaults
	viper.SetDefault("server.host", "0.0.0.0")
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("server.read_timeout", 60)
	// 对于SSE长连接，写超时为0（不限制）
	viper.SetDefault("server.write_timeout", 0)
	// SSE 心跳，默认5秒（可根据代理链路调小）
	viper.SetDefault("server.sse_heartbeat", 5)

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
	viper.SetDefault("ai.llm.provider", "claude")
	viper.SetDefault("ai.llm.model", "claude-3-sonnet-20240229")
	viper.SetDefault("ai.llm.temperature", 0.7)
	viper.SetDefault("ai.llm.max_tokens", 2000)
	viper.SetDefault("ai.llm.timeout", 60)
	viper.SetDefault("ai.llm.top_k", 5)
	viper.SetDefault("ai.llm.top_p", 0.9)
	viper.SetDefault("ai.llm.retry_count", 3)
	viper.SetDefault("ai.llm.retry_delay", 1)
	viper.SetDefault("ai.llm.system_prompt", `你是工程效能 AI 助手，面向研发、运维、技术支持等角色。

你的能力包括但不限于：
1. 故障诊断与解决方案
2. 配置与最佳实践建议
3. 性能监控与分析
4. 日常运维与研发协作支持

你可以调用已集成的工具（监控、日志、CI/CD、外部 API 等）与知识库（文档、Runbook、FAQ），分析问题并给出可执行建议。

当使用工具后：请阅读工具返回的数据，总结关键结果，给出清晰的结论与可执行步骤；如工具失败，请解释原因并给出替代方案。

请始终：
- 提供准确、专业的技术建议
- 根据用户问题给出具体的操作步骤
- 必要时询问更多上下文
- 保持友好、专业的交流方式`)

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
	// 工具规划相关默认
	viper.SetDefault("ai.agent.tool_plan_max_iter", 1)
	viper.SetDefault("ai.agent.tool_intent_enabled", true)

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
