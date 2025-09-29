-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 创建默认用户（密码：admin123）
INSERT INTO users (id, username, email, password_hash, display_name, role, status) VALUES
(
    uuid_generate_v4(),
    'admin',
    'admin@cdnagent.com',
    crypt('admin123', gen_salt('bf')),
    '系统管理员',
    'admin',
    'active'
) ON CONFLICT (username) DO NOTHING;

-- 创建默认知识分类
INSERT INTO knowledge_categories (id, name, description, sort_order, status) VALUES
(uuid_generate_v4(), 'CDN基础', 'CDN基础知识和概念', 1, 'active'),
(uuid_generate_v4(), '故障排查', 'CDN故障诊断和解决方案', 2, 'active'),
(uuid_generate_v4(), '性能优化', 'CDN性能调优相关文档', 3, 'active'),
(uuid_generate_v4(), '最佳实践', 'CDN使用最佳实践', 4, 'active');

-- 创建系统配置
INSERT INTO system_configs (id, config_key, config_value, description, config_type) VALUES
(uuid_generate_v4(), 'system.name', '{"value": "CDN AI Agent"}', '系统名称', 'system'),
(uuid_generate_v4(), 'system.version', '{"value": "1.0.0"}', '系统版本', 'system'),
(uuid_generate_v4(), 'ai.max_tokens', '{"value": 4000}', 'AI最大token数', 'ai'),
(uuid_generate_v4(), 'ai.temperature', '{"value": 0.7}', 'AI回复温度', 'ai');

-- 创建索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_status ON conversations(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_documents_category_id ON knowledge_documents(category_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_documents_status ON knowledge_documents(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_documents_tags ON knowledge_documents USING GIN(tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_knowledge_embeddings_document_id ON knowledge_embeddings(document_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tools_enabled ON tools(enabled);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_executions_tool_id ON tool_executions(tool_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_executions_user_id ON tool_executions(user_id);