# AI功能配置说明

## 快速配置

1. **复制配置文件**
   ```bash
   cp .env.example .env
   ```

2. **配置Claude API**
   编辑 `.env` 文件，设置你的Claude API信息：
   ```env
   CDNAGENT_AI_LLM_API_KEY=your-claude-api-key
   CDNAGENT_AI_LLM_BASE_URL=https://your-third-party-api.com/v1
   ```

3. **启动服务器**
   ```bash
   go run cmd/server/main.go
   ```

## 支持的AI模型

### Claude (推荐)
- 模型: claude-3-sonnet-20240229, claude-3-haiku-20240229, claude-3-opus-20240229
- 配置: 通过第三方API或官方API

### OpenAI
- 模型: gpt-3.5-turbo, gpt-4
- 配置: 设置 `CDNAGENT_AI_LLM_PROVIDER=openai`

## 配置选项

### 基础配置
- `CDNAGENT_AI_LLM_PROVIDER`: 模型提供商 (claude/openai)
- `CDNAGENT_AI_LLM_MODEL`: 具体模型名称
- `CDNAGENT_AI_LLM_API_KEY`: API密钥
- `CDNAGENT_AI_LLM_BASE_URL`: API基础URL

### 高级配置
- `CDNAGENT_AI_LLM_TEMPERATURE`: 温度参数 (0.0-1.0)
- `CDNAGENT_AI_LLM_MAX_TOKENS`: 最大token数
- `CDNAGENT_AI_LLM_TOP_K`: Top-K采样 (仅Claude)
- `CDNAGENT_AI_LLM_TOP_P`: Top-P采样

## 测试AI功能

1. 访问前端页面: http://localhost:8080
2. 创建新对话
3. 发送测试消息: "你好，请介绍一下CDN的工作原理"

## 故障排除

### 常见错误
- **401 Unauthorized**: 检查API_KEY是否正确
- **404 Not Found**: 检查BASE_URL是否正确
- **Connection Error**: 检查网络连接和防火墙设置

### 调试模式
```bash
# 启用详细日志
export GIN_MODE=debug
go run cmd/server/main.go
```

### 健康检查
```bash
curl http://localhost:8080/health
```

## 自定义系统提示词

可以通过配置文件 `config/config.json` 中的 `ai.llm.system_prompt` 字段自定义AI的系统提示词，使其更适合你的具体业务场景。