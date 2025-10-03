# AI引擎架构设计文档 (基于Eino框架)

## 文档信息
- **创建日期**: 2025-09-29
- **技术栈**: Go + Eino Framework
- **AI框架**: CloudWeGo Eino
- **框架版本**: 最新版本

> 说明：本文档中的代码与示例以 CDN 业务为主要演示，实际工程中可替换为任意业务域（监控、日志、CI/CD、业务中台等）。

## 1. Eino框架核心概念

### 1.1 组件抽象 (Components)
```go
// ChatModel - LLM模型接口
type BaseChatModel interface {
    Generate(ctx context.Context, input []*schema.Message, opts ...Option) (*schema.Message, error)
    Stream(ctx context.Context, input []*schema.Message, opts ...Option) (*schema.StreamReader[*schema.Message], error)
}

// Tools - 工具调用接口
type Tool interface {
    InvokeableComponent
    ToolInfo() *schema.ToolInfo
}

// Template - Prompt模板接口
type ChatTemplate interface {
    Format(ctx context.Context, input map[string]any, opts ...Option) ([]*schema.Message, error)
}
```

### 1.2 编排方式 (Orchestration)
- **Chain**: 简单前向链式编排
- **Graph**: 灵活的图编排（支持循环）
- **Workflow**: 结构化数据映射的工作流

## 2. 工程效能 AI 助手架构设计

### 2.1 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP/SSE API Layer                       │
│              Gin + Streaming Response                       │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   AI Service Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ ChatService │  │AgentService │  │ RAGService  │         │
│  │  简单对话    │  │  复杂推理   │  │  知识检索   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                 Eino Orchestration Layer                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Chain    │  │    Graph    │  │  Workflow   │         │
│  │  线性编排    │  │  图编排     │  │  工作流     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                Eino Components Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ ChatModel   │  │    Tools    │  │ Templates   │         │
│  │  LLM接入    │  │   工具集成   │  │ Prompt管理  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                External Services Layer                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │OpenAI/Qwen  │  │  Grafana    │  │PostgreSQL   │         │
│  │  LLM模型    │  │  监控工具   │  │  数据存储   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## 3. 核心组件实现

### 3.1 ChatModel配置（示例）
> 说明：以下示例使用 `CDNAIEngine` 等命名以 CDN 业务为例，实际工程中可替换为通用命名（如 `Engine`）。
```go
package ai

import (
    "context"
    "github.com/cloudwego/eino/components/model"
    "github.com/cloudwego/eino/schema"
)

type CDNAIEngine struct {
    chatModel model.ChatModel
    tools     map[string]model.Tool
    templates map[string]model.ChatTemplate
    config    *AIConfig
}

func NewCDNAIEngine(config *AIConfig) (*CDNAIEngine, error) {
    engine := &CDNAIEngine{
        tools:     make(map[string]model.Tool),
        templates: make(map[string]model.ChatTemplate),
        config:    config,
    }
    
    // 初始化ChatModel
    if err := engine.initChatModel(); err != nil {
        return nil, err
    }
    
    // 初始化Tools
    if err := engine.initTools(); err != nil {
        return nil, err
    }
    
    // 初始化Templates
    if err := engine.initTemplates(); err != nil {
        return nil, err
    }
    
    return engine, nil
}

func (e *CDNAIEngine) initChatModel() error {
    var chatModel model.ChatModel
    var err error
    
    switch e.config.LLMProvider {
    case "openai":
        chatModel, err = model.NewOpenAIChatModel(context.Background(), &model.OpenAIChatModelConfig{
            Model:       e.config.ModelName,
            APIKey:      e.config.APIKey,
            BaseURL:     e.config.BaseURL,
            Temperature: &e.config.Temperature,
            MaxTokens:   &e.config.MaxTokens,
        })
    case "qwen":
        // 假设Eino支持通义千问
        chatModel, err = model.NewQwenChatModel(context.Background(), &model.QwenChatModelConfig{
            Model:       e.config.ModelName,
            APIKey:      e.config.APIKey,
            Temperature: &e.config.Temperature,
            MaxTokens:   &e.config.MaxTokens,
        })
    default:
        return fmt.Errorf("unsupported LLM provider: %s", e.config.LLMProvider)
    }
    
    if err != nil {
        return fmt.Errorf("failed to initialize chat model: %w", err)
    }
    
    e.chatModel = chatModel
    return nil
}
```

### 3.2 Tools实现（示例：以 CDN 业务为例）
```go
// CDN Grafana监控工具
type GrafanaTool struct {
    baseURL string
    apiKey  string
    client  *http.Client
}

func NewGrafanaTool(baseURL, apiKey string) *GrafanaTool {
    return &GrafanaTool{
        baseURL: baseURL,
        apiKey:  apiKey,
        client:  &http.Client{Timeout: 30 * time.Second},
    }
}

// 实现Eino Tool接口
func (gt *GrafanaTool) ToolInfo() *schema.ToolInfo {
    return &schema.ToolInfo{
        Name:        "grafana_query",
        Description: "查询Grafana监控数据，支持PromQL（示例：以 CDN 性能指标为例）",
        Parameters: &schema.Parameters{
            Type: "object",
            Properties: map[string]*schema.Property{
                "query": {
                    Type:        "string",
                    Description: "PromQL查询语句，例如：rate(http_requests_total[5m])",
                },
                "start": {
                    Type:        "string",
                    Description: "查询开始时间(RFC3339格式)，例如：2025-09-29T10:00:00Z",
                },
                "end": {
                    Type:        "string", 
                    Description: "查询结束时间(RFC3339格式)，例如：2025-09-29T11:00:00Z",
                },
                "step": {
                    Type:        "string",
                    Description: "查询步长，例如：15s",
                },
            },
            Required: []string{"query"},
        },
    }
}

func (gt *GrafanaTool) Invoke(ctx context.Context, input string) (string, error) {
    // 解析工具调用参数
    var params map[string]interface{}
    if err := json.Unmarshal([]byte(input), &params); err != nil {
        return "", fmt.Errorf("解析参数失败: %w", err)
    }
    
    query, ok := params["query"].(string)
    if !ok {
        return "", fmt.Errorf("缺少必需参数: query")
    }
    
    // 构建Grafana API请求
    req, err := gt.buildGrafanaRequest(ctx, params)
    if err != nil {
        return "", fmt.Errorf("构建请求失败: %w", err)
    }
    
    // 执行HTTP请求
    resp, err := gt.client.Do(req)
    if err != nil {
        return "", fmt.Errorf("请求Grafana失败: %w", err)
    }
    defer resp.Body.Close()
    
    // 解析响应
    var result GrafanaQueryResult
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return "", fmt.Errorf("解析响应失败: %w", err)
    }
    
    // 格式化返回结果
    formatted := gt.formatQueryResult(&result)
    return formatted, nil
}

// 日志查询工具（示例：以 CDN 业务为例）
type CDNLogTool struct {
    elasticClient *elasticsearch.Client
}

func NewCDNLogTool(elasticURL, username, password string) (*CDNLogTool, error) {
    cfg := elasticsearch.Config{
        Addresses: []string{elasticURL},
        Username:  username,
        Password:  password,
    }
    
    client, err := elasticsearch.NewClient(cfg)
    if err != nil {
        return nil, err
    }
    
    return &CDNLogTool{elasticClient: client}, nil
}

func (lt *CDNLogTool) ToolInfo() *schema.ToolInfo {
    return &schema.ToolInfo{
        Name:        "log_query",
        Description: "查询访问日志和错误日志（示例：以 CDN 为例），分析流量模式和故障信息",
        Parameters: &schema.Parameters{
            Type: "object",
            Properties: map[string]*schema.Property{
                "query": {
                    Type:        "string",
                    Description: "Elasticsearch查询语句或关键词",
                },
                "time_range": {
                    Type:        "string",
                    Description: "时间范围，例如：1h, 24h, 7d",
                },
                "log_level": {
                    Type:        "string",
                    Description: "日志级别：error, warn, info",
                },
                "domain": {
                    Type:        "string",
                    Description: "域名过滤",
                },
            },
            Required: []string{"query"},
        },
    }
}

func (lt *CDNLogTool) Invoke(ctx context.Context, input string) (string, error) {
    // 实现日志查询逻辑
    // ...
    return "日志查询结果", nil
}
```

### 3.3 简单对话Chain
```go
// 简单对话服务 - 使用Eino Chain
type SimpleChatService struct {
    engine *CDNAIEngine
}

func (scs *SimpleChatService) ProcessQuery(ctx context.Context, userQuery string) (*schema.Message, error) {
    // 构建简单的Chain: Template -> ChatModel
    chain, err := compose.NewChain[map[string]any, *schema.Message]().
        AppendChatTemplate(scs.engine.templates["simple_chat"]).
        AppendChatModel(scs.engine.chatModel).
        Compile(ctx)
    
    if err != nil {
        return nil, fmt.Errorf("编译Chain失败: %w", err)
    }
    
    // 执行Chain
    result, err := chain.Invoke(ctx, map[string]any{
        "user_query": userQuery,
        "timestamp": time.Now().Format(time.RFC3339),
    })
    
    if err != nil {
        return nil, fmt.Errorf("Chain执行失败: %w", err)
    }
    
    return result, nil
}

// 流式对话
func (scs *SimpleChatService) ProcessStreamQuery(ctx context.Context, userQuery string, eventChan chan<- *StreamEvent) error {
    defer close(eventChan)
    
    // 构建流式Chain
    chain, err := compose.NewChain[map[string]any, *schema.StreamReader[*schema.Message]]().
        AppendChatTemplate(scs.engine.templates["simple_chat"]).
        AppendStreamingChatModel(scs.engine.chatModel). // 使用流式版本
        Compile(ctx)
    
    if err != nil {
        return fmt.Errorf("编译流式Chain失败: %w", err)
    }
    
    // 执行Chain获取流
    streamReader, err := chain.Invoke(ctx, map[string]any{
        "user_query": userQuery,
    })
    
    if err != nil {
        return fmt.Errorf("Chain执行失败: %w", err)
    }
    
    // 处理流式数据
    var fullContent strings.Builder
    for {
        chunk, err := streamReader.Recv()
        if err == io.EOF {
            break
        }
        if err != nil {
            eventChan <- &StreamEvent{Type: "error", Data: map[string]interface{}{
                "message": err.Error(),
            }}
            return err
        }
        
        delta := chunk.Content
        fullContent.WriteString(delta)
        
        // 发送增量事件
        eventChan <- &StreamEvent{
            Type: "content_delta",
            Data: map[string]interface{}{
                "delta": delta,
            },
        }
    }
    
    // 发送完成事件
    eventChan <- &StreamEvent{
        Type: "message_complete",
        Data: map[string]interface{}{
            "final_content": fullContent.String(),
        },
    }
    
    return nil
}
```

### 3.4 ReAct Agent实现
```go
// 专家Agent（示例：以 CDN 业务为例） - 使用Eino Graph
type CDNExpertAgent struct {
    engine *CDNAIEngine
    ragService *RAGService
}

func (agent *CDNExpertAgent) ProcessComplexQuery(ctx context.Context, userQuery string) (*AgentResponse, error) {
    // 构建ReAct Agent Graph
    graph := compose.NewGraph[map[string]any, *AgentResponse]()
    
    // 1. 添加意图识别节点
    intentNode := &IntentNode{
        chatModel: agent.engine.chatModel,
        template:  agent.engine.templates["intent_recognition"],
    }
    graph.AddNode("intent", intentNode)
    
    // 2. 添加知识检索节点  
    ragNode := &RAGNode{
        ragService: agent.ragService,
    }
    graph.AddNode("rag", ragNode)
    
    // 3. 添加工具调用节点
    toolNode := compose.NewToolsNode(
        agent.engine.chatModel,
        []model.Tool{
            agent.engine.tools["grafana_query"],
            agent.engine.tools["log_query"],
        },
    )
    graph.AddNode("tools", toolNode)
    
    // 4. 添加答案生成节点
    answerNode := &AnswerNode{
        chatModel: agent.engine.chatModel,
        template:  agent.engine.templates["answer_generation"],
    }
    graph.AddNode("answer", answerNode)
    
    // 5. 定义节点间的流转条件
    graph.AddEdge("intent", "rag", nil) // 无条件进入RAG
    
    // 根据意图决定是否需要工具调用
    graph.AddEdge("rag", "tools", func(state map[string]any) bool {
        intent, _ := state["intent"].(string)
        return intent == "monitoring" || intent == "troubleshooting"
    })
    
    // 不需要工具的直接生成答案
    graph.AddEdge("rag", "answer", func(state map[string]any) bool {
        intent, _ := state["intent"].(string)
        return intent == "knowledge" || intent == "general"
    })
    
    // 工具调用后生成最终答案
    graph.AddEdge("tools", "answer", nil)
    
    // 6. 编译并执行Graph
    compiledGraph, err := graph.Compile(ctx)
    if err != nil {
        return nil, fmt.Errorf("编译Graph失败: %w", err)
    }
    
    // 执行Agent
    result, err := compiledGraph.Invoke(ctx, map[string]any{
        "user_query": userQuery,
        "timestamp":  time.Now(),
    })
    
    if err != nil {
        return nil, fmt.Errorf("Agent执行失败: %w", err)
    }
    
    return result, nil
}

// 流式ReAct Agent
func (agent *CDNExpertAgent) ProcessStreamComplexQuery(ctx context.Context, userQuery string, eventChan chan<- *StreamEvent) error {
    defer close(eventChan)
    
    // 发送开始事件
    eventChan <- &StreamEvent{Type: "agent_start", Data: map[string]interface{}{
        "timestamp": time.Now(),
    }}
    
    // 构建可观察的Graph，支持步骤级回调
    graph := compose.NewGraph[map[string]any, *AgentResponse]()
    
    // 添加回调来发送中间事件
    graph.WithCallback(func(nodeName string, input, output any) {
        eventChan <- &StreamEvent{
            Type: "step_complete",
            Data: map[string]interface{}{
                "step":   nodeName,
                "output": output,
            },
        }
    })
    
    // ... 添加节点和边的逻辑同上 ...
    
    // 执行带有流式输出的Graph
    result, err := graph.Invoke(ctx, map[string]any{
        "user_query": userQuery,
    })
    
    if err != nil {
        eventChan <- &StreamEvent{Type: "error", Data: map[string]interface{}{
            "message": err.Error(),
        }}
        return err
    }
    
    eventChan <- &StreamEvent{Type: "agent_complete", Data: result}
    return nil
}
```

### 3.5 自定义节点实现
```go
// 意图识别节点
type IntentNode struct {
    chatModel model.ChatModel
    template  model.ChatTemplate
}

func (node *IntentNode) Invoke(ctx context.Context, input map[string]any) (map[string]any, error) {
    // 使用模板格式化Prompt
    messages, err := node.template.Format(ctx, input)
    if err != nil {
        return nil, err
    }
    
    // 调用LLM识别意图
    response, err := node.chatModel.Generate(ctx, messages)
    if err != nil {
        return nil, err
    }
    
    intent := strings.TrimSpace(response.Content)
    
    // 返回增强的状态
    output := make(map[string]any)
    for k, v := range input {
        output[k] = v
    }
    output["intent"] = intent
    
    return output, nil
}

// RAG检索节点
type RAGNode struct {
    ragService *RAGService
}

func (node *RAGNode) Invoke(ctx context.Context, input map[string]any) (map[string]any, error) {
    userQuery, _ := input["user_query"].(string)
    
    // 执行RAG检索
    chunks, err := node.ragService.Retrieve(ctx, userQuery, nil)
    if err != nil {
        return nil, err
    }
    
    // 返回增强的状态
    output := make(map[string]any)
    for k, v := range input {
        output[k] = v
    }
    output["knowledge_chunks"] = chunks
    
    return output, nil
}

// 答案生成节点
type AnswerNode struct {
    chatModel model.ChatModel
    template  model.ChatTemplate
}

func (node *AnswerNode) Invoke(ctx context.Context, input map[string]any) (*AgentResponse, error) {
    // 使用模板整合所有上下文信息
    messages, err := node.template.Format(ctx, input)
    if err != nil {
        return nil, err
    }
    
    // 生成最终答案
    response, err := node.chatModel.Generate(ctx, messages)
    if err != nil {
        return nil, err
    }
    
    return &AgentResponse{
        Content:   response.Content,
        Intent:    input["intent"].(string),
        Sources:   input["knowledge_chunks"],
        ToolCalls: input["tool_results"],
        Timestamp: time.Now(),
    }, nil
}
```

## 4. Prompt模板管理

### 4.1 基于Eino的模板系统
```go
func (e *CDNAIEngine) initTemplates() error {
    // 1. 简单对话模板
    simpleChatTemplate, err := template.NewChatTemplate(
        "simple_chat",
        []*schema.Message{
            {
                Role: "system",
                Content: `你是专业的CDN技术专家助手，名为CDN Agent。

专业领域：
- CDN架构设计和优化
- 性能监控和故障排查  
- 缓存策略和配置管理
- 网络安全和访问控制

回答风格：
- 专业、准确、实用
- 提供具体的解决方案
- 适当使用技术术语
- 简洁明了，重点突出

当前时间：{{.timestamp}}`,
            },
            {
                Role: "user", 
                Content: "{{.user_query}}",
            },
        },
    )
    if err != nil {
        return fmt.Errorf("创建简单对话模板失败: %w", err)
    }
    e.templates["simple_chat"] = simpleChatTemplate
    
    // 2. 意图识别模板
    intentTemplate, err := template.NewChatTemplate(
        "intent_recognition",
        []*schema.Message{
            {
                Role: "system",
                Content: `你需要识别用户查询的意图类型。

请分析用户查询，从以下意图中选择最匹配的一个：

1. knowledge - 知识查询
   - CDN概念解释、原理说明
   - 配置方法、最佳实践
   - 技术对比、方案选择

2. monitoring - 监控查询  
   - 查看性能指标、流量数据
   - 监控图表、报表分析
   - 实时状态查询

3. troubleshooting - 故障排查
   - 问题诊断、错误分析
   - 性能异常调查
   - 故障恢复建议

4. configuration - 配置操作
   - 修改CDN设置
   - 更新缓存策略
   - 安全配置调整

5. general - 一般对话
   - 问候、闲聊
   - 功能介绍
   - 使用帮助

只返回意图类型名称，不要其他内容。`,
            },
            {
                Role: "user",
                Content: "{{.user_query}}",
            },
        },
    )
    if err != nil {
        return fmt.Errorf("创建意图识别模板失败: %w", err)
    }
    e.templates["intent_recognition"] = intentTemplate
    
    // 3. 答案生成模板
    answerTemplate, err := template.NewChatTemplate(
        "answer_generation", 
        []*schema.Message{
            {
                Role: "system",
                Content: `你是专业的CDN技术专家，基于提供的上下文信息回答用户问题。

## 上下文信息

{{if .knowledge_chunks}}
### 相关知识
{{range .knowledge_chunks}}
**{{.title}}**
{{.content}}
---
{{end}}
{{end}}

{{if .tool_results}}
### 实时数据
{{range .tool_results}}
**{{.tool_name}}执行结果：**
{{.result}}
---
{{end}}
{{end}}

## 回答要求
1. 基于上下文信息进行专业回答
2. 如果信息不足，明确说明限制
3. 提供具体、可操作的建议
4. 使用结构化格式便于阅读
5. 包含相关的配置示例或命令

用户问题：{{.user_query}}`,
            },
        },
    )
    if err != nil {
        return fmt.Errorf("创建答案生成模板失败: %w", err)
    }
    e.templates["answer_generation"] = answerTemplate
    
    return nil
}
```

## 5. RAG服务集成

### 5.1 RAG作为独立服务
```go
type RAGService struct {
    db            *gorm.DB
    embeddingAPI  *EmbeddingAPI
    config        *RAGConfig
}

type RAGConfig struct {
    TopK           int     `yaml:"top_k"`
    ScoreThreshold float64 `yaml:"score_threshold"`
    VectorWeight   float64 `yaml:"vector_weight"`
    TextWeight     float64 `yaml:"text_weight"`
}

func NewRAGService(db *gorm.DB, embeddingAPI *EmbeddingAPI, config *RAGConfig) *RAGService {
    return &RAGService{
        db:           db,
        embeddingAPI: embeddingAPI,
        config:       config,
    }
}

func (rs *RAGService) Retrieve(ctx context.Context, query string, filters map[string]interface{}) ([]*RetrievedChunk, error) {
    // 1. 查询向量化
    queryVector, err := rs.embeddingAPI.Embed(ctx, query)
    if err != nil {
        return nil, fmt.Errorf("查询向量化失败: %w", err)
    }
    
    // 2. 向量检索
    vectorChunks, err := rs.vectorSearch(ctx, queryVector, filters)
    if err != nil {
        return nil, fmt.Errorf("向量检索失败: %w", err)
    }
    
    // 3. 全文检索 
    textChunks, err := rs.textSearch(ctx, query, filters)
    if err != nil {
        return nil, fmt.Errorf("全文检索失败: %w", err)
    }
    
    // 4. 混合排序
    finalChunks := rs.hybridRanking(vectorChunks, textChunks)
    
    // 5. 截断到TopK
    if len(finalChunks) > rs.config.TopK {
        finalChunks = finalChunks[:rs.config.TopK]
    }
    
    return finalChunks, nil
}
```

## 6. 服务整合和API

### 6.1 AI服务统一接口
```go
type AIService struct {
    simpleChatService *SimpleChatService
    agentService      *CDNExpertAgent
    ragService        *RAGService
    engine            *CDNAIEngine
}

func NewAIService(config *AIConfig) (*AIService, error) {
    // 初始化AI引擎
    engine, err := NewCDNAIEngine(config)
    if err != nil {
        return nil, err
    }
    
    // 初始化RAG服务
    ragService := NewRAGService(db, embeddingAPI, &config.RAG)
    
    return &AIService{
        simpleChatService: &SimpleChatService{engine: engine},
        agentService:      &CDNExpertAgent{engine: engine, ragService: ragService},
        ragService:        ragService,
        engine:            engine,
    }, nil
}

// 简单对话接口
func (as *AIService) Chat(ctx context.Context, req *ChatRequest) (*ChatResponse, error) {
    message, err := as.simpleChatService.ProcessQuery(ctx, req.Content)
    if err != nil {
        return nil, err
    }
    
    return &ChatResponse{
        Content:   message.Content,
        Type:      "simple",
        Timestamp: time.Now(),
    }, nil
}

// 流式对话接口
func (as *AIService) StreamChat(ctx context.Context, req *ChatRequest, eventChan chan<- *StreamEvent) error {
    return as.simpleChatService.ProcessStreamQuery(ctx, req.Content, eventChan)
}

// 复杂Agent接口
func (as *AIService) AgentChat(ctx context.Context, req *ChatRequest) (*AgentResponse, error) {
    return as.agentService.ProcessComplexQuery(ctx, req.Content)
}

// 流式Agent接口
func (as *AIService) StreamAgentChat(ctx context.Context, req *ChatRequest, eventChan chan<- *StreamEvent) error {
    return as.agentService.ProcessStreamComplexQuery(ctx, req.Content, eventChan)
}
```

## 7. 配置和初始化

### 7.1 配置结构
```go
type AIConfig struct {
    // LLM配置
    LLMProvider string  `yaml:"llm_provider"` // openai, qwen
    ModelName   string  `yaml:"model_name"`   // gpt-4, qwen-plus
    APIKey      string  `yaml:"api_key"`
    BaseURL     string  `yaml:"base_url"`
    Temperature float64 `yaml:"temperature"`
    MaxTokens   int     `yaml:"max_tokens"`
    
    // RAG配置
    RAG RAGConfig `yaml:"rag"`
    
    // 工具配置
    Tools ToolsConfig `yaml:"tools"`
}

type ToolsConfig struct {
    Grafana GrafanaConfig `yaml:"grafana"`
    Logs    LogsConfig    `yaml:"logs"`
}

type GrafanaConfig struct {
    BaseURL string `yaml:"base_url"`
    APIKey  string `yaml:"api_key"`
}

type LogsConfig struct {
    ElasticURL string `yaml:"elastic_url"`
    Username   string `yaml:"username"`
    Password   string `yaml:"password"`
}
```

---

**文档版本**: v2.0  
**最后更新**: 2025-09-29  
**基于**: Eino框架真实API  
**维护人**: AI团队
