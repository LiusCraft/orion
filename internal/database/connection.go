package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/liusCraft/orion/internal/config"
	"github.com/liusCraft/orion/internal/database/models"
)

func Init(cfg *config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=%s client_encoding=UTF8",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode, cfg.TimeZone)

	// 配置GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	// 连接数据库
	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// 配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	// 安装pgvector扩展 (临时注释，待扩展安装完成后启用)
	// if err := db.Exec("CREATE EXTENSION IF NOT EXISTS vector").Error; err != nil {
	//	return nil, fmt.Errorf("failed to create vector extension: %w", err)
	// }

	return db, nil
}

func Migrate(db *gorm.DB) error {
	// 自动迁移数据库表
	err := db.AutoMigrate(
		&models.User{},
		&models.UserSession{},
		&models.Conversation{},
		&models.Message{},
		&models.MessageAttachment{},
		&models.KnowledgeCategory{},
		&models.KnowledgeDocument{},
		&models.KnowledgeDocumentVersion{},
		&models.KnowledgeEmbedding{},
		&models.Tool{},
		&models.ToolExecution{},
		&models.SystemConfig{},
		&models.AuditLog{},
		&models.UsageStatistic{},
	)

	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	return nil
}
