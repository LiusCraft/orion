package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/pgvector/pgvector-go"
	"gorm.io/gorm"
)

// JSONMap 自定义JSON类型，用于处理PostgreSQL的JSONB字段
type JSONMap map[string]interface{}

// Value 实现 driver.Valuer 接口
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan 实现 sql.Scanner 接口
func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("cannot scan non-string value into JSONMap")
	}

	var result JSONMap
	err := json.Unmarshal(bytes, &result)
	*j = result
	return err
}

// User 用户表
type User struct {
	ID          uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Username    string     `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	Email       string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	DisplayName string     `gorm:"type:varchar(100)" json:"display_name"`
	AvatarURL   string     `gorm:"type:text" json:"avatar_url"`
	Role        string     `gorm:"type:varchar(20);not null;default:'user'" json:"role"` // admin, user, viewer
	Department  string     `gorm:"type:varchar(50)" json:"department"`                    // 运维、研发、TS
	Status      string     `gorm:"type:varchar(20);not null;default:'active'" json:"status"` // active, inactive, suspended
	LastLoginAt *time.Time `gorm:"type:timestamptz" json:"last_login_at"`
	CreatedAt   time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
}

//UserSession 用户会话表
type UserSession struct {
	ID         uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	TokenHash  string    `gorm:"type:varchar(255);not null;index" json:"-"`
	DeviceInfo JSONMap   `gorm:"type:jsonb" json:"device_info"`
	IPAddress  string    `gorm:"type:inet" json:"ip_address"`
	ExpiresAt  time.Time `gorm:"type:timestamptz;not null;index" json:"expires_at"`
	CreatedAt  time.Time `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	User       User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

// Conversation 对话会话表
type Conversation struct {
	ID              uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Title           string     `gorm:"type:varchar(200)" json:"title"`
	Context         JSONMap    `gorm:"type:jsonb" json:"context"`
	Status          string     `gorm:"type:varchar(20);not null;default:'active';index" json:"status"` // active, archived, deleted
	TotalMessages   int        `gorm:"not null;default:0" json:"total_messages"`
	LastMessageAt   *time.Time `gorm:"type:timestamptz;index" json:"last_message_at"`
	CreatedAt       time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
	User            User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

// Message 消息表
type Message struct {
	ID               uuid.UUID     `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConversationID   uuid.UUID     `gorm:"type:uuid;not null;index" json:"conversation_id"`
	ParentMessageID  *uuid.UUID    `gorm:"type:uuid;index" json:"parent_message_id"`
	SenderType       string        `gorm:"type:varchar(10);not null;index" json:"sender_type"` // user, ai, system
	Content          string        `gorm:"type:text;not null" json:"content"`
	ContentType      string        `gorm:"type:varchar(20);not null;default:'text'" json:"content_type"` // text, markdown, json
	Metadata         JSONMap       `gorm:"type:jsonb" json:"metadata"`
	TokenCount       *int          `gorm:"type:int" json:"token_count"`
	ProcessingTimeMs *int          `gorm:"type:int" json:"processing_time_ms"`
	Status           string        `gorm:"type:varchar(20);not null;default:'completed'" json:"status"` // pending, completed, failed, streaming
	ErrorMessage     string        `gorm:"type:text" json:"error_message"`
    CreatedAt        time.Time     `gorm:"type:timestamptz;not null;default:now();index" json:"created_at"`
    UpdatedAt        time.Time     `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
    Conversation     Conversation  `gorm:"foreignKey:ConversationID;constraint:OnDelete:CASCADE" json:"conversation,omitempty"`
    ParentMessage    *Message      `gorm:"foreignKey:ParentMessageID" json:"parent_message,omitempty"`
}

// MessageAttachment 消息附件表
type MessageAttachment struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	MessageID uuid.UUID `gorm:"type:uuid;not null;index" json:"message_id"`
	FileName  string    `gorm:"type:varchar(255);not null" json:"file_name"`
	FilePath  string    `gorm:"type:text;not null" json:"file_path"`
	FileSize  int64     `gorm:"type:bigint;not null" json:"file_size"`
	MimeType  string    `gorm:"type:varchar(100)" json:"mime_type"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	Message   Message   `gorm:"foreignKey:MessageID;constraint:OnDelete:CASCADE" json:"message,omitempty"`
}

// KnowledgeCategory 知识分类表
type KnowledgeCategory struct {
	ID          uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ParentID    *uuid.UUID             `gorm:"type:uuid;index" json:"parent_id"`
	Name        string                 `gorm:"type:varchar(100);not null" json:"name"`
	Description string                 `gorm:"type:text" json:"description"`
	SortOrder   int                    `gorm:"not null;default:0" json:"sort_order"`
	Status      string                 `gorm:"type:varchar(20);not null;default:'active';index" json:"status"` // active, inactive
	CreatedAt   time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
	Parent      *KnowledgeCategory     `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children    []KnowledgeCategory    `gorm:"foreignKey:ParentID" json:"children,omitempty"`
}

// KnowledgeDocument 知识文档表
type KnowledgeDocument struct {
	ID           uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CategoryID   uuid.UUID              `gorm:"type:uuid;not null;index" json:"category_id"`
	Title        string                 `gorm:"type:varchar(200);not null" json:"title"`
	Content      string                 `gorm:"type:text;not null" json:"content"`
	ContentType  string                 `gorm:"type:varchar(20);not null;default:'markdown'" json:"content_type"` // markdown, html, text
	Summary      string                 `gorm:"type:text" json:"summary"`
	Tags         pq.StringArray         `gorm:"type:text[];index:,type:gin" json:"tags"`
	SourceURL    string                 `gorm:"type:text" json:"source_url"`
	AuthorID     *uuid.UUID             `gorm:"type:uuid;index" json:"author_id"`
	Version      int                    `gorm:"not null;default:1" json:"version"`
	Status       string                 `gorm:"type:varchar(20);not null;default:'published';index" json:"status"` // draft, published, archived
	ViewCount    int                    `gorm:"not null;default:0" json:"view_count"`
	LikeCount    int                    `gorm:"not null;default:0" json:"like_count"`
	CreatedAt    time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt    time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
	Category     KnowledgeCategory      `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Author       *User                  `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
}

// KnowledgeDocumentVersion 文档版本表
type KnowledgeDocumentVersion struct {
	ID            uuid.UUID         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	DocumentID    uuid.UUID         `gorm:"type:uuid;not null;uniqueIndex:idx_doc_version,priority:1" json:"document_id"`
	Version       int               `gorm:"not null;uniqueIndex:idx_doc_version,priority:2" json:"version"`
	Title         string            `gorm:"type:varchar(200);not null" json:"title"`
	Content       string            `gorm:"type:text;not null" json:"content"`
	ChangeSummary string            `gorm:"type:text" json:"change_summary"`
	AuthorID      *uuid.UUID        `gorm:"type:uuid" json:"author_id"`
	CreatedAt     time.Time         `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	Document      KnowledgeDocument `gorm:"foreignKey:DocumentID;constraint:OnDelete:CASCADE" json:"document,omitempty"`
	Author        *User             `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
}

// KnowledgeEmbedding 知识向量表
type KnowledgeEmbedding struct {
	ID           uuid.UUID       `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	DocumentID   uuid.UUID       `gorm:"type:uuid;not null;index" json:"document_id"`
	ChunkIndex   int             `gorm:"not null;uniqueIndex:idx_doc_chunk,priority:2" json:"chunk_index"`
	ChunkContent string          `gorm:"type:text;not null" json:"chunk_content"`
	ChunkSummary string          `gorm:"type:text" json:"chunk_summary"`
	Embedding    pgvector.Vector `gorm:"type:vector(1536)" json:"-"` // OpenAI text-embedding-ada-002的维度
	TokenCount   *int            `gorm:"type:int" json:"token_count"`
	CreatedAt    time.Time       `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	Document     KnowledgeDocument `gorm:"foreignKey:DocumentID;constraint:OnDelete:CASCADE" json:"document,omitempty"`
}

// Tool 工具配置表
type Tool struct {
	ID          uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Name        string                 `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	DisplayName string                 `gorm:"type:varchar(100);not null" json:"display_name"`
	Description string                 `gorm:"type:text" json:"description"`
    ToolType    string   `gorm:"type:varchar(50);not null;index" json:"tool_type"` // api, webhook, script, mcp
    Config      JSONMap  `gorm:"type:jsonb;not null" json:"config"`
    AuthConfig  JSONMap  `gorm:"type:jsonb" json:"auth_config"`
	Enabled     bool                   `gorm:"not null;default:true;index" json:"enabled"`
	CreatedBy   *uuid.UUID             `gorm:"type:uuid" json:"created_by"`
	CreatedAt   time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt   time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
	Creator     *User                  `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
}

// ToolExecution 工具执行记录表
type ToolExecution struct {
	ID              uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ToolID          uuid.UUID              `gorm:"type:uuid;not null;index" json:"tool_id"`
	MessageID       *uuid.UUID             `gorm:"type:uuid;index" json:"message_id"`
	UserID          uuid.UUID              `gorm:"type:uuid;not null;index" json:"user_id"`
    InputParams     JSONMap `gorm:"type:jsonb;not null" json:"input_params"`
    OutputResult    JSONMap `gorm:"type:jsonb" json:"output_result"`
	ExecutionTimeMs *int                   `gorm:"type:int" json:"execution_time_ms"`
	Status          string                 `gorm:"type:varchar(20);not null;index" json:"status"` // pending, success, failed, timeout
	ErrorMessage    string                 `gorm:"type:text" json:"error_message"`
	CreatedAt       time.Time              `gorm:"type:timestamptz;not null;default:now();index" json:"created_at"`
	Tool            Tool                   `gorm:"foreignKey:ToolID" json:"tool,omitempty"`
	Message         *Message               `gorm:"foreignKey:MessageID" json:"message,omitempty"`
	User            User                   `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// SystemConfig 系统配置表
type SystemConfig struct {
	ID            uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ConfigKey     string                 `gorm:"type:varchar(100);uniqueIndex;not null" json:"config_key"`
    ConfigValue   JSONMap `gorm:"type:jsonb;not null" json:"config_value"`
	Description   string                 `gorm:"type:text" json:"description"`
	ConfigType    string                 `gorm:"type:varchar(50);not null;index" json:"config_type"` // llm, database, cache, etc.
	IsEncrypted   bool                   `gorm:"not null;default:false" json:"is_encrypted"`
	UpdatedBy     *uuid.UUID             `gorm:"type:uuid" json:"updated_by"`
	CreatedAt     time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
	UpdatedAt     time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
	UpdatedByUser *User                  `gorm:"foreignKey:UpdatedBy" json:"updated_by_user,omitempty"`
}

// AuditLog 审计日志表
type AuditLog struct {
	ID           uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID       *uuid.UUID             `gorm:"type:uuid;index" json:"user_id"`
	Action       string                 `gorm:"type:varchar(100);not null;index" json:"action"` // create, update, delete, login, etc.
	ResourceType string                 `gorm:"type:varchar(50);not null;index" json:"resource_type"` // user, document, tool, etc.
	ResourceID   *uuid.UUID             `gorm:"type:uuid;index" json:"resource_id"`
	OldValues    map[string]interface{} `gorm:"type:jsonb" json:"old_values"`
	NewValues    map[string]interface{} `gorm:"type:jsonb" json:"new_values"`
	IPAddress    string                 `gorm:"type:inet" json:"ip_address"`
	UserAgent    string                 `gorm:"type:text" json:"user_agent"`
	CreatedAt    time.Time              `gorm:"type:timestamptz;not null;default:now();index" json:"created_at"`
	User         *User                  `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// UsageStatistic 使用统计表
type UsageStatistic struct {
	ID          uuid.UUID              `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Date        time.Time              `gorm:"type:date;not null;uniqueIndex:idx_date_type,priority:1" json:"date"`
	MetricType  string                 `gorm:"type:varchar(50);not null;index;uniqueIndex:idx_date_type,priority:2" json:"metric_type"` // daily_active_users, message_count, etc.
	MetricValue int64                  `gorm:"type:bigint;not null" json:"metric_value"`
	Dimensions  map[string]interface{} `gorm:"type:jsonb" json:"dimensions"`
	CreatedAt   time.Time              `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
}

// BeforeCreate hook for User
func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}
