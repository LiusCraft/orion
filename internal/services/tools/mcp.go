package tools

import (
    "context"
    "errors"
    "fmt"
    "encoding/json"
    "os/exec"
    "strings"
    "time"

    einotool "github.com/cloudwego/eino/components/tool"
    "github.com/cloudwego/eino/schema"
    mcpp "github.com/cloudwego/eino-ext/components/tool/mcp"
    "github.com/mark3labs/mcp-go/client"
    "github.com/mark3labs/mcp-go/client/transport"
    "github.com/mark3labs/mcp-go/mcp"
    "strconv"
)

// MCPTransport 协议类型
const (
    MCPProtoSSE            = "sse"
    MCPProtoHTTPStreamable = "http_streamable"
    MCPProtoSTDIO          = "stdio"
)

// TestMCPConnection 尝试建立与 MCP Server 的连接并返回可用工具数量
// cfg 期望字段：
// - protocol: sse|http_streamable|stdio (required)
// - endpoint: string (sse/http_streamable 必填)
// - authorization: string (可选，用于网络协议)
// - timeout: number(seconds) 可选
// - command: string (stdio 必填)
// - args: string (可选，空格分隔)
// - env: string (可选，按\n或;分隔的 KEY=VALUE 列表)
func TestMCPConnection(ctx context.Context, cfg map[string]interface{}) (int, error) {
    cli, closeFn, err := buildMCPClient(ctx, cfg)
    if err != nil {
        return 0, err
    }
    defer func() { _ = closeFn() }()

    // initialize
    initReq := mcp.InitializeRequest{}
    initReq.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
    initReq.Params.ClientInfo = mcp.Implementation{
        Name:    "cdnagent",
        Version: "1.0.0",
    }
    if _, err := cli.Initialize(ctx, initReq); err != nil {
        return 0, fmt.Errorf("mcp initialize failed: %w", err)
    }

    // list tools
    tools, err := mcpp.GetTools(ctx, &mcpp.Config{Cli: cli})
    if err != nil {
        return 0, fmt.Errorf("mcp list tools failed: %w", err)
    }
    return len(tools), nil
}

// BuildMCPTools 返回 Eino 的工具集合以及清理函数
// prefixName 用于给工具名前缀（避免多服务器重名冲突），可为空
// allowList 逗号分隔工具白名单，可为空
func BuildMCPTools(ctx context.Context, cfg map[string]interface{}, prefixName string, allowList string) ([]einotool.BaseTool, func() error, error) {
    cli, closeFn, err := buildMCPClient(ctx, cfg)
    if err != nil {
        return nil, func() error { return nil }, err
    }

    initReq := mcp.InitializeRequest{}
    initReq.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
    initReq.Params.ClientInfo = mcp.Implementation{Name: "cdnagent", Version: "1.0.0"}
    if _, err := cli.Initialize(ctx, initReq); err != nil {
        _ = closeFn()
        return nil, func() error { return nil }, fmt.Errorf("mcp initialize failed: %w", err)
    }

    var names []string
    if allowList != "" {
        for _, s := range strings.Split(allowList, ",") {
            s = strings.TrimSpace(s)
            if s != "" {
                names = append(names, s)
            }
        }
    }

    tools, err := mcpp.GetTools(ctx, &mcpp.Config{Cli: cli, ToolNameList: names})
    if err != nil {
        _ = closeFn()
        return nil, func() error { return nil }, fmt.Errorf("mcp get tools failed: %w", err)
    }

    // 包装工具信息以添加前缀（避免重名）
    if prefixName != "" {
        wrapped := make([]einotool.BaseTool, 0, len(tools))
        for _, t := range tools {
            wrapped = append(wrapped, wrapToolNamePrefix(t, prefixName+"__"))
        }
        tools = wrapped
    }

    return tools, closeFn, nil
}

// FetchMCPServerInfo 连接 MCP Server 并返回 server 初始化信息与工具元数据列表
// 返回：serverInfo 为任意结构map（来自 InitializeResult），toolsMeta 为每个工具的 {name, description, inputSchema}
func FetchMCPServerInfo(ctx context.Context, cfg map[string]interface{}) (map[string]interface{}, []map[string]interface{}, error) {
    cli, closeFn, err := buildMCPClient(ctx, cfg)
    if err != nil {
        return nil, nil, err
    }
    defer func() { _ = closeFn() }()

    initReq := mcp.InitializeRequest{}
    initReq.Params.ProtocolVersion = mcp.LATEST_PROTOCOL_VERSION
    initReq.Params.ClientInfo = mcp.Implementation{Name: "cdnagent", Version: "1.0.0"}
    initRes, err := cli.Initialize(ctx, initReq)
    if err != nil {
        return nil, nil, fmt.Errorf("mcp initialize failed: %w", err)
    }

    // convert initRes to map
    serverInfo := map[string]interface{}{}
    if b, e := json.Marshal(initRes); e == nil {
        _ = json.Unmarshal(b, &serverInfo)
    }

    listRes, err := cli.ListTools(ctx, mcp.ListToolsRequest{})
    if err != nil {
        return serverInfo, nil, fmt.Errorf("mcp list tools failed: %w", err)
    }

    toolsMeta := make([]map[string]interface{}, 0, len(listRes.Tools))
    for _, t := range listRes.Tools {
        m := map[string]interface{}{
            "name":        t.Name,
            "description": t.Description,
        }
        // input schema to map
        if b, e := json.Marshal(t.InputSchema); e == nil {
            var is map[string]interface{}
            if err := json.Unmarshal(b, &is); err == nil {
                m["inputSchema"] = is
            }
        }
        toolsMeta = append(toolsMeta, m)
    }

    return serverInfo, toolsMeta, nil
}

// buildMCPClient 根据配置构造 MCP 客户端
func buildMCPClient(ctx context.Context, cfg map[string]interface{}) (client.MCPClient, func() error, error) {
    proto, _ := asString(cfg["protocol"])
    if proto == "" {
        return nil, func() error { return nil }, errors.New("missing protocol")
    }
    timeout := asInt(cfg["timeout"]) // seconds
    if timeout <= 0 {
        timeout = 15
    }

    switch proto {
    case MCPProtoSSE:
        endpoint, _ := asString(cfg["endpoint"])
        if endpoint == "" {
            return nil, func() error { return nil }, errors.New("missing endpoint for sse")
        }
        headers := map[string]string{}
        if hv, _ := asString(cfg["headers"]); hv != "" {
            for k, v := range parseHeadersString(hv) { headers[k] = v }
        }
        if v, _ := asString(cfg["authorization"]); v != "" {
            headers["Authorization"] = maybeBearer(v)
        }
        opts := []transport.ClientOption{}
        if len(headers) > 0 {
            opts = append(opts, client.WithHeaders(headers))
        }
        c, err := client.NewSSEMCPClient(endpoint, opts...)
        if err != nil {
            return nil, func() error { return nil }, err
        }
        if err := c.Start(ctx); err != nil {
            return nil, func() error { return nil }, err
        }
        return c, c.Close, nil

    case MCPProtoHTTPStreamable:
        endpoint, _ := asString(cfg["endpoint"])
        if endpoint == "" {
            return nil, func() error { return nil }, errors.New("missing endpoint for http_streamable")
        }
        hopts := []transport.StreamableHTTPCOption{
            transport.WithHTTPTimeout(time.Duration(timeout) * time.Second),
        }
        hdrs := map[string]string{}
        if hv, _ := asString(cfg["headers"]); hv != "" {
            for k, v := range parseHeadersString(hv) { hdrs[k] = v }
        }
        if v, _ := asString(cfg["authorization"]); v != "" { hdrs["Authorization"] = maybeBearer(v) }
        if len(hdrs) > 0 { hopts = append(hopts, transport.WithHTTPHeaders(hdrs)) }
        c, err := client.NewStreamableHttpClient(endpoint, hopts...)
        if err != nil {
            return nil, func() error { return nil }, err
        }
        if err := c.Start(ctx); err != nil {
            return nil, func() error { return nil }, err
        }
        return c, c.Close, nil

    case MCPProtoSTDIO:
        command, _ := asString(cfg["command"])
        if command == "" {
            return nil, func() error { return nil }, errors.New("missing command for stdio")
        }
        argsStr, _ := asString(cfg["args"]) // space separated
        var args []string
        if argsStr != "" {
            args = splitArgs(argsStr)
        }
        var env []string
        if envStr, _ := asString(cfg["env"]); envStr != "" {
            // split by newline or ;
            raw := strings.FieldsFunc(envStr, func(r rune) bool { return r == '\n' || r == ';' })
            for _, kv := range raw {
                kv = strings.TrimSpace(kv)
                if kv != "" {
                    env = append(env, kv)
                }
            }
        }
        // Validate command exists (best-effort)
        if _, err := exec.LookPath(command); err != nil {
            // 不阻断：某些环境中可能在运行时才可用
        }
        c, err := client.NewStdioMCPClientWithOptions(command, env, args, /* no extra opts */)
        if err != nil {
            return nil, func() error { return nil }, err
        }
        return c, c.Close, nil
    default:
        return nil, func() error { return nil }, fmt.Errorf("unsupported mcp protocol: %s", proto)
    }
}

// wrapToolNamePrefix 返回一个包裹后工具，在 Info() 时给 Name 添加前缀，但保持 InvokableRun 直通
func wrapToolNamePrefix(base einotool.BaseTool, prefix string) einotool.BaseTool {
    type invokable interface {
        einotool.BaseTool
        InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error)
    }
    return &prefixedTool{base: base, prefix: prefix}
}

type prefixedTool struct {
    base   einotool.BaseTool
    prefix string
}

func (p *prefixedTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
    // We don't have direct type SchemaToolInfo; use schema.ToolInfo from Eino
    // But to avoid import cycling, fetch via BaseTool and copy.
    info, err := p.base.Info(ctx)
    if err != nil {
        return nil, err
    }
    // Create a shallow copy with prefixed name
    // Note: schema.ToolInfo is from github.com/cloudwego/eino/schema, type alias below
    dup := *info
    dup.Name = p.prefix + info.Name
    return &dup, nil
}

// Implement InvokableTool if base supports it
func (p *prefixedTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error) {
    if inv, ok := p.base.(interface{
        InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error)
    }); ok {
        return inv.InvokableRun(ctx, argumentsInJSON, opts...)
    }
    return "", errors.New("tool is not invokable")
}

// helpers
func asString(v any) (string, bool) {
    s, ok := v.(string)
    return s, ok
}

func asInt(v any) int {
    switch t := v.(type) {
    case int:
        return t
    case int32:
        return int(t)
    case int64:
        return int(t)
    case float64:
        return int(t)
    case float32:
        return int(t)
    case string:
        if t == "" { return 0 }
        n, _ := strconv.Atoi(strings.TrimSpace(t))
        return n
    default:
        return 0
    }
}

func maybeBearer(s string) string {
    if s == "" {
        return s
    }
    if strings.HasPrefix(strings.ToLower(strings.TrimSpace(s)), "bearer ") {
        return s
    }
    return "Bearer " + s
}

func splitArgs(s string) []string {
    s = strings.TrimSpace(s)
    if s == "" {
        return nil
    }
    // simple split by spaces
    parts := strings.Fields(s)
    return parts
}

// parseHeadersString 将多行 header 文本解析为 map，忽略空行与无冒号行
func parseHeadersString(s string) map[string]string {
    res := map[string]string{}
    if s == "" { return res }
    lines := strings.Split(s, "\n")
    for _, line := range lines {
        line = strings.TrimSpace(line)
        if line == "" { continue }
        // split at first ':'
        idx := strings.Index(line, ":")
        if idx <= 0 { continue }
        k := strings.TrimSpace(line[:idx])
        v := strings.TrimSpace(line[idx+1:])
        if k != "" { res[k] = v }
    }
    return res
}
