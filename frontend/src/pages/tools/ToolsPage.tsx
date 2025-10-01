import React, { useState } from "react";
import {
  Card,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  Divider,
  Switch,
  Badge,
  Descriptions,
  Tabs,
  List,
  Input,
  Form,
  Modal,
  message,
  Spin,
  Alert,
  Select,
  Collapse,
} from "antd";
import {
  ApiOutlined,
  MonitorOutlined,
  FileSearchOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  EditOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toolService } from "../../services/toolService";
import type {
  Tool,
  ToolExecution,
  CreateToolRequest,
  UpdateToolRequest,
} from "../../types";

// 辅助类型与工具
interface McpToolInfo {
  name?: string;
  description?: string;
  inputSchema?: unknown;
}

interface TestPreview {
  responseTime?: number;
  toolCount?: number;
  server?: Record<string, unknown>;
  tools?: McpToolInfo[];
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null;

// 工具配置 Schema 类型
interface ToolConfigSchema {
  title?: string;
  type: string;
  format?: string;
  description?: string;
  required?: boolean;
}

// Badge 状态类型
type BadgeStatus = "success" | "processing" | "default" | "error" | "warning";

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

interface CreateToolModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateToolModal: React.FC<CreateToolModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [selectedType, setSelectedType] = useState<string>("");
  const [mcpProtocol, setMcpProtocol] = useState<string>("http_streamable");
  const [createTestPreview, setCreateTestPreview] =
    useState<TestPreview | null>(null);
  const queryClient = useQueryClient();

  const { data: toolTypes } = useQuery({
    queryKey: ["toolTypes"],
    queryFn: toolService.getToolTypes,
  });

  const { data: toolTemplate } = useQuery({
    queryKey: ["toolTemplate", selectedType],
    queryFn: () => toolService.getToolTemplate(selectedType),
    enabled: !!selectedType,
  });

  const createToolMutation = useMutation({
    mutationFn: toolService.createTool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      message.success("工具创建成功");
      form.resetFields();
      setSelectedType("");
      onSuccess();
      onClose();
    },
    onError: () => {
      message.error("工具创建失败");
    },
  });

  // 创建表单内测试连接
  const testCreateMutation = useMutation({
    mutationFn: ({
      toolType,
      config,
    }: {
      toolType: string;
      config: Record<string, unknown>;
    }) => toolService.testTool({ toolType, config }),
    onSuccess: (res: {
      success: boolean;
      message: string;
      responseTime?: number;
      details?: Record<string, unknown>;
    }) => {
      if (res.success) {
        message.success(res.message || "测试成功");
        const details = (res.details || {}) as Record<string, unknown>;
        const toolCount =
          typeof details["toolCount"] === "number"
            ? (details["toolCount"] as number)
            : undefined;
        const server = isRecord(details["server"])
          ? (details["server"] as Record<string, unknown>)
          : undefined;
        const tools = Array.isArray(details["tools"])
          ? (details["tools"] as McpToolInfo[])
          : undefined;
        setCreateTestPreview({
          responseTime: res.responseTime,
          toolCount,
          server,
          tools,
        });
      } else {
        message.error(res.message || "测试失败");
        setCreateTestPreview(null);
      }
    },
    onError: () => {
      message.error("测试连接失败");
      setCreateTestPreview(null);
    },
  });

  const handleSubmit = (
    values: CreateToolRequest & Record<string, unknown>,
  ) => {
    const { name, displayName, description, toolType, ...restUnknown } =
      values as Record<string, unknown>;

    // 特殊处理 mcp：根据协议整理配置
    let config: Record<string, unknown> = { ...restUnknown };
    if (toolType === "mcp") {
      const r = restUnknown as Record<string, unknown>;
      const protocol = String(r["protocol"] ?? "");
      config = { protocol };
      if (protocol === "http_streamable" || protocol === "sse") {
        if (r["endpoint"]) config.endpoint = r["endpoint"];
        if (r["timeout"]) config.timeout = Number(r["timeout"]);
        if (r["allowTools"]) config.allowTools = r["allowTools"] as string;
        if (r["headersText"]) config.headers = r["headersText"] as string; // 多行header
      } else if (protocol === "stdio") {
        if (r["command"]) config.command = r["command"];
        if (r["args"]) config.args = r["args"] as string; // 空格分隔
        if (r["envText"]) config.env = r["envText"] as string; // 多行或分号分隔
      }
    }
    createToolMutation.mutate({
      name: String(name ?? ""),
      displayName: String(displayName ?? ""),
      description: String(description ?? ""),
      toolType: String(toolType ?? ""),
      config,
      enabled: true,
    });
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    if (type === "mcp") {
      // 为 mcp 类型设置默认值
      form.setFieldsValue({ protocol: "http_streamable", timeout: 15 });
      setMcpProtocol("http_streamable");
      setCreateTestPreview(null);
    } else if (toolTemplate) {
      form.setFieldsValue(toolTemplate.defaultConfig);
      setCreateTestPreview(null);
    }
  };

  const handleTestInCreate = () => {
    const v = form.getFieldsValue() as Record<string, unknown>;
    const toolType = v.toolType as string;
    if (!toolType) {
      message.warning("请先选择工具类型");
      return;
    }
    let config: Record<string, unknown> = {};
    if (toolType === "mcp") {
      const protocol = v.protocol as string;
      config.protocol = protocol;
      if (protocol === "http_streamable" || protocol === "sse") {
        if (v.endpoint) config.endpoint = v.endpoint as string;
        if (v.timeout) config.timeout = Number(v.timeout as number);
        if (v.allowTools) config.allowTools = v.allowTools as string;
        if (v.headersText) config.headers = v.headersText as string;
        else config.headers = "";
      } else if (protocol === "stdio") {
        if (v.command) config.command = v.command as string;
        if (v.args) config.args = v.args as string;
        if (v.envText) config.env = v.envText as string;
        else config.env = "";
      }
    } else {
      const rest: Record<string, unknown> = { ...v };
      delete rest["toolType"];
      delete rest["name"];
      delete rest["displayName"];
      delete rest["description"];
      config = rest;
    }
    testCreateMutation.mutate({ toolType, config });
  };

  return (
    <Modal
      title="添加新工具"
      open={visible}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={createToolMutation.isPending}
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="工具类型"
          name="toolType"
          rules={[{ required: true, message: "请选择工具类型" }]}
        >
          <Select
            placeholder="选择工具类型"
            onChange={handleTypeChange}
            options={toolTypes?.map((type) => ({
              label: type.name,
              value: type.type,
              description: type.description,
            }))}
          />
        </Form.Item>

        <Form.Item
          label="工具名称"
          name="name"
          rules={[{ required: true, message: "请输入工具名称" }]}
        >
          <Input placeholder="输入唯一的工具标识名" />
        </Form.Item>

        <Form.Item
          label="显示名称"
          name="displayName"
          rules={[{ required: true, message: "请输入显示名称" }]}
        >
          <Input placeholder="输入用户友好的显示名称" />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} placeholder="描述工具的功能和用途" />
        </Form.Item>

        {selectedType === "mcp" && (
          <>
            <Divider>工具配置 - MCP</Divider>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 8,
              }}
            >
              <Button
                icon={<ReloadOutlined />}
                onClick={handleTestInCreate}
                loading={testCreateMutation.isPending}
              >
                测试连接
              </Button>
            </div>
            <Form.Item
              label="协议"
              name="protocol"
              rules={[{ required: true, message: "请选择协议" }]}
            >
              <Select
                options={[
                  { label: "HTTP Streamable", value: "http_streamable" },
                  { label: "SSE", value: "sse" },
                  { label: "STDIO", value: "stdio" },
                ]}
                onChange={(v) => setMcpProtocol(v)}
              />
            </Form.Item>

            {(mcpProtocol === "http_streamable" || mcpProtocol === "sse") && (
              <>
                <Form.Item
                  label="Endpoint"
                  name="endpoint"
                  rules={[{ required: true, message: "请输入 Endpoint" }]}
                >
                  <Input placeholder="如：https://api.host/v1/mcp/http-streamable/xxxx 或 https://api.host/v1/mcp/sse" />
                </Form.Item>
                <Form.Item
                  label="Headers"
                  name="headersText"
                  tooltip="每行一个Header，例如 Authorization: Bearer xxx"
                >
                  <Input.TextArea
                    rows={4}
                    placeholder={
                      "Authorization: Bearer <token>\nX-Custom-Header: value"
                    }
                  />
                </Form.Item>
                <Form.Item label="超时(秒)" name="timeout">
                  <Input type="number" placeholder="默认15" />
                </Form.Item>
                <Form.Item label="工具白名单(逗号分隔)" name="allowTools">
                  <Input placeholder="留空表示全部，例如 time.now,time.convert" />
                </Form.Item>
              </>
            )}

            {mcpProtocol === "stdio" && (
              <>
                <Form.Item
                  label="命令"
                  name="command"
                  rules={[{ required: true, message: "请输入命令路径" }]}
                >
                  <Input placeholder="如 ./mcp-server 或 /usr/local/bin/mcp-server" />
                </Form.Item>
                <Form.Item label="参数" name="args">
                  <Input placeholder="空格分隔，例如 --flag value" />
                </Form.Item>
                <Form.Item
                  label="环境变量"
                  name="envText"
                  tooltip="每行或用分号分隔，例如 FOO=bar;TOKEN=xxx"
                >
                  <Input.TextArea rows={4} placeholder={"FOO=bar\nTOKEN=xxx"} />
                </Form.Item>
              </>
            )}
          </>
        )}

        {selectedType === "mcp" && createTestPreview && (
          <Card size="small" style={{ marginTop: 12 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span>
                  耗时: <b>{createTestPreview.responseTime ?? 0} ms</b>
                </span>
                <span>
                  可用工具数: <b>{createTestPreview.toolCount ?? 0}</b>
                </span>
              </div>
              {createTestPreview.server && (
                <Collapse size="small" destroyInactivePanel>
                  <Collapse.Panel header="MCP Server 信息" key="server">
                    <pre
                      style={{
                        background: "#f7f7f7",
                        padding: 8,
                        borderRadius: 6,
                        overflow: "auto",
                      }}
                    >
                      {JSON.stringify(createTestPreview.server, null, 2)}
                    </pre>
                  </Collapse.Panel>
                </Collapse>
              )}
              {createTestPreview.tools &&
                Array.isArray(createTestPreview.tools) &&
                createTestPreview.tools.length > 0 && (
                  <Collapse size="small" destroyInactivePanel>
                    {createTestPreview.tools.map((t, idx) => (
                      <Collapse.Panel
                        header={`${t.name || "(unknown)"} - ${t.description || ""}`}
                        key={String(idx)}
                      >
                        {t.inputSchema ? (
                          <>
                            <div style={{ marginBottom: 6 }}>
                              输入参数(JSONSchema):
                            </div>
                            <pre
                              style={{
                                background: "#f7f7f7",
                                padding: 8,
                                borderRadius: 6,
                                overflow: "auto",
                              }}
                            >
                              {JSON.stringify(t.inputSchema, null, 2)}
                            </pre>
                          </>
                        ) : (
                          <span style={{ color: "#999" }}>无参数定义</span>
                        )}
                      </Collapse.Panel>
                    ))}
                  </Collapse>
                )}
            </Space>
          </Card>
        )}

        {selectedType && selectedType !== "mcp" && toolTemplate && (
          <>
            <Divider>工具配置</Divider>
            {/* 根据工具类型动态渲染配置表单 */}
            {(
              Object.entries(toolTemplate.configSchema) as [
                string,
                ToolConfigSchema,
              ][]
            ).map(([key, schema]) => (
              <Form.Item
                key={key}
                label={schema.title || key}
                name={key}
                rules={
                  schema.required
                    ? [
                        {
                          required: true,
                          message: `请输入${schema.title || key}`,
                        },
                      ]
                    : []
                }
              >
                {schema.type === "string" && schema.format === "password" ? (
                  <Input.Password placeholder={schema.description} />
                ) : schema.type === "number" ? (
                  <Input type="number" placeholder={schema.description} />
                ) : schema.type === "boolean" ? (
                  <Switch />
                ) : (
                  <Input placeholder={schema.description} />
                )}
              </Form.Item>
            ))}
          </>
        )}
      </Form>
    </Modal>
  );
};

const ToolsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [editMcpProtocol, setEditMcpProtocol] =
    useState<string>("http_streamable");
  const [editTestPreview, setEditTestPreview] = useState<TestPreview | null>(
    null,
  );
  const [form] = Form.useForm();

  // 获取工具列表
  const {
    data: toolsData,
    isLoading: toolsLoading,
    error: toolsError,
  } = useQuery({
    queryKey: ["tools"],
    queryFn: () => toolService.getTools(1, 50),
  });

  // 获取工具统计
  const { data: toolStats } = useQuery({
    queryKey: ["toolStats"],
    queryFn: toolService.getToolStats,
  });

  // 获取工具执行历史
  const { data: executionsData } = useQuery({
    queryKey: ["toolExecutions"],
    queryFn: () => toolService.getToolExecutions(undefined, 1, 20),
  });

  // 更新工具
  const updateToolMutation = useMutation({
    mutationFn: ({
      toolId,
      data,
    }: {
      toolId: string;
      data: UpdateToolRequest;
    }) => toolService.updateTool(toolId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      message.success("工具更新成功");
    },
    onError: () => {
      message.error("工具更新失败");
    },
  });

  // 切换工具状态
  const toggleToolMutation = useMutation({
    mutationFn: ({ toolId, enabled }: { toolId: string; enabled: boolean }) =>
      toolService.toggleTool(toolId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
    },
    onError: () => {
      message.error("切换工具状态失败");
    },
  });

  // 测试工具连接
  const testToolMutation = useMutation({
    mutationFn: ({
      toolType,
      config,
    }: {
      toolType: string;
      config: Record<string, unknown>;
    }) => toolService.testTool({ toolType, config }),
    onSuccess: (result) => {
      if (result.success) {
        message.success(`测试成功: ${result.message}`);
      } else {
        message.error(`测试失败: ${result.message}`);
      }
    },
    onError: () => {
      message.error("测试连接失败");
    },
  });

  // 编辑弹窗内测试连接（独立于卡片按钮）
  const testInEditMutation = useMutation({
    mutationFn: ({
      toolType,
      config,
    }: {
      toolType: string;
      config: Record<string, unknown>;
    }) => toolService.testTool({ toolType, config }),
    onSuccess: (res: {
      success: boolean;
      message: string;
      responseTime?: number;
      details?: Record<string, unknown>;
    }) => {
      if (res.success) {
        message.success(res.message || "测试成功");
        const details = (res.details || {}) as Record<string, unknown>;
        const toolCount =
          typeof details["toolCount"] === "number"
            ? (details["toolCount"] as number)
            : undefined;
        const server = isRecord(details["server"])
          ? (details["server"] as Record<string, unknown>)
          : undefined;
        const tools = Array.isArray(details["tools"])
          ? (details["tools"] as McpToolInfo[])
          : undefined;
        setEditTestPreview({
          responseTime: res.responseTime,
          toolCount,
          server,
          tools,
        });
      } else {
        message.error(res.message || "测试失败");
        setEditTestPreview(null);
      }
    },
    onError: () => {
      message.error("测试连接失败");
      setEditTestPreview(null);
    },
  });

  // 删除工具
  const deleteToolMutation = useMutation({
    mutationFn: toolService.deleteTool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tools"] });
      message.success("工具删除成功");
    },
    onError: () => {
      message.error("工具删除失败");
    },
  });

  const tools = toolsData?.data || [];

  const getTypeIcon = (toolType: string) => {
    switch (toolType) {
      case "monitoring":
      case "prometheus":
      case "grafana":
        return <MonitorOutlined />;
      case "logging":
      case "elasticsearch":
      case "loki":
        return <FileSearchOutlined />;
      case "api":
      case "webhook":
      case "http":
      case "mcp":
        return <ApiOutlined />;
      case "config":
      default:
        return <SettingOutlined />;
    }
  };

  const getStatusColor = (
    enabled: boolean,
    lastStatus?: string,
  ): BadgeStatus => {
    if (!enabled) return "default";
    if (lastStatus === "error") return "error";
    return "success";
  };

  const getStatusText = (enabled: boolean, lastStatus?: string) => {
    if (!enabled) return "已禁用";
    if (lastStatus === "error") return "连接异常";
    return "正常运行";
  };

  const handleToolToggle = (toolId: string, checked: boolean) => {
    toggleToolMutation.mutate({ toolId, enabled: checked });
  };

  const handleConfigTool = (tool: Tool) => {
    setSelectedTool(tool);
    setEditTestPreview(null);
    // 预填表单
    const base: Record<string, unknown> = {
      displayName: tool.displayName,
      description: tool.description,
    };
    if (tool.toolType === "mcp") {
      const cfg = (tool.config || {}) as Record<string, unknown>;
      const proto = (cfg.protocol as string) || "http_streamable";
      setEditMcpProtocol(proto);
      base.protocol = proto;
      if (proto === "http_streamable" || proto === "sse") {
        base.endpoint = cfg.endpoint;
        base.timeout = cfg.timeout;
        base.allowTools = cfg.allowTools;
        // headers 存成字符串（多行）
        base.headersText = cfg.headers || "";
      } else if (proto === "stdio") {
        base.command = cfg.command;
        base.args = cfg.args;
        base.envText = cfg.env || "";
      }
    } else {
      Object.assign(base, tool.config || {});
    }
    form.setFieldsValue(base);
    setConfigModalVisible(true);
  };

  const handleTestConnection = (tool: Tool) => {
    testToolMutation.mutate({
      toolType: tool.toolType,
      config: tool.config,
    });
  };

  const handleSaveConfig = () => {
    form.validateFields().then((values) => {
      if (selectedTool) {
        const v = values as Record<string, unknown>;
        const displayName = v.displayName;
        const description = v.description;
        let config: Record<string, unknown> = {};
        if (selectedTool.toolType === "mcp") {
          const protocol = v.protocol as string;
          config.protocol = protocol;
          if (protocol === "http_streamable" || protocol === "sse") {
            if (v.endpoint) config.endpoint = v.endpoint as string;
            if (v.timeout) config.timeout = Number(v.timeout as number);
            if (v.allowTools) config.allowTools = v.allowTools as string;
            if (v.headersText) config.headers = v.headersText as string;
            else config.headers = "";
          } else if (protocol === "stdio") {
            if (v.command) config.command = v.command as string;
            if (v.args) config.args = v.args as string;
            if (v.envText) config.env = v.envText as string;
            else config.env = "";
          }
        } else {
          const rest: Record<string, unknown> = { ...v };
          delete rest["displayName"];
          delete rest["description"];
          config = rest;
        }
        updateToolMutation.mutate({
          toolId: selectedTool.id,
          data: {
            displayName: displayName as string,
            description: description as string,
            config,
          },
        });
        setConfigModalVisible(false);
        setSelectedTool(null);
        form.resetFields();
      }
    });
  };

  // 在编辑弹窗内“测试连接”——基于当前表单值构造config后调用后端 /tools/test
  const handleTestConfigInModal = () => {
    if (!selectedTool) return;
    const v = form.getFieldsValue() as Record<string, unknown>;
    let config: Record<string, unknown> = {};
    if (selectedTool.toolType === "mcp") {
      const protocol = v.protocol as string;
      config.protocol = protocol;
      if (protocol === "http_streamable" || protocol === "sse") {
        if (v.endpoint) config.endpoint = v.endpoint as string;
        if (v.timeout) config.timeout = Number(v.timeout as number);
        if (v.allowTools) config.allowTools = v.allowTools as string;
        if (v.headersText) config.headers = v.headersText as string;
        else config.headers = "";
      } else if (protocol === "stdio") {
        if (v.command) config.command = v.command as string;
        if (v.args) config.args = v.args as string;
        if (v.envText) config.env = v.envText as string;
        else config.env = "";
      }
    } else {
      const rest: Record<string, unknown> = { ...v };
      delete rest["displayName"];
      delete rest["description"];
      config = rest;
    }
    testInEditMutation.mutate({ toolType: selectedTool.toolType, config });
  };

  const handleDeleteTool = (toolId: string) => {
    Modal.confirm({
      title: "确认删除",
      content: "确定要删除这个工具吗？此操作无法撤销。",
      onOk: () => {
        deleteToolMutation.mutate(toolId);
      },
    });
  };

  const renderToolCard = (tool: Tool) => (
    <Card
      key={tool.id}
      title={
        <Space>
          {getTypeIcon(tool.toolType)}
          <span>{tool.displayName || tool.name}</span>
          <Badge
            status={getStatusColor(tool.enabled, tool.lastStatus)}
            text={getStatusText(tool.enabled, tool.lastStatus)}
          />
        </Space>
      }
      extra={
        <Space>
          <Switch
            checked={tool.enabled}
            onChange={(checked) => handleToolToggle(tool.id, checked)}
            loading={toggleToolMutation.isPending}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleConfigTool(tool)}
          />
          <Button
            type="text"
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteTool(tool.id)}
          />
        </Space>
      }
      style={{ marginBottom: "16px" }}
    >
      <Paragraph ellipsis={{ rows: 2 }}>{tool.description}</Paragraph>

      <Descriptions size="small" column={1}>
        <Descriptions.Item label="工具类型">
          <Tag>{tool.toolType}</Tag>
        </Descriptions.Item>
        {tool.toolType === "mcp" &&
          (() => {
            const cfg = (tool.config || {}) as Record<string, unknown>;
            const mcpToolsRaw = (cfg as { mcp_tools?: unknown }).mcp_tools;
            const count = Array.isArray(mcpToolsRaw) ? mcpToolsRaw.length : 0;
            return (
              <Descriptions.Item label="支持能力">{count} 项</Descriptions.Item>
            );
          })()}
        {tool.lastExecutedAt && (
          <Descriptions.Item label="最后使用">
            {new Date(tool.lastExecutedAt).toLocaleString("zh-CN")}
          </Descriptions.Item>
        )}
        {tool.executionCount !== undefined && (
          <Descriptions.Item label="执行次数">
            {tool.executionCount} 次
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* MCP 能力预览（只读，默认折叠，不撑外部容器；展开时内部预设最大高度滚动） */}
      {tool.toolType === "mcp" &&
        (() => {
          const cfg = (tool.config || {}) as Record<string, unknown>;
          const mcpServer = (cfg as { mcp_server?: unknown }).mcp_server;
          const mcpToolsRaw = (cfg as { mcp_tools?: unknown }).mcp_tools;
          const mcpTools: McpToolInfo[] = Array.isArray(mcpToolsRaw)
            ? (mcpToolsRaw as McpToolInfo[])
            : [];
          return (
            <>
              {isRecord(mcpServer) && (
                <Collapse
                  size="small"
                  destroyInactivePanel
                  style={{ marginTop: 8 }}
                >
                  <Collapse.Panel header="MCP Server 信息" key="server-info">
                    <pre
                      style={{
                        background: "#f7f7f7",
                        padding: 8,
                        borderRadius: 6,
                        maxHeight: 220,
                        overflow: "auto",
                      }}
                    >
                      {JSON.stringify(mcpServer, null, 2)}
                    </pre>
                  </Collapse.Panel>
                </Collapse>
              )}
              {mcpTools.length > 0 && (
                <Collapse
                  size="small"
                  destroyInactivePanel
                  style={{ marginTop: 8 }}
                >
                  {mcpTools.map((t, idx: number) => (
                    <Collapse.Panel
                      header={`${t.name || "(unknown)"} - ${t.description || ""}`}
                      key={`cap-${idx}`}
                    >
                      {t.inputSchema ? (
                        <>
                          <div style={{ marginBottom: 6 }}>
                            输入参数(JSONSchema):
                          </div>
                          <pre
                            style={{
                              background: "#f7f7f7",
                              padding: 8,
                              borderRadius: 6,
                              maxHeight: 220,
                              overflow: "auto",
                            }}
                          >
                            {JSON.stringify(t.inputSchema, null, 2)}
                          </pre>
                        </>
                      ) : (
                        <span style={{ color: "#999" }}>无参数定义</span>
                      )}
                    </Collapse.Panel>
                  ))}
                </Collapse>
              )}
            </>
          );
        })()}

      <Divider style={{ margin: "12px 0" }} />

      <Space>
        <Button
          type="primary"
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => handleTestConnection(tool)}
          disabled={!tool.enabled}
          loading={testToolMutation.isPending}
        >
          测试连接
        </Button>
        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={() => handleConfigTool(tool)}
        >
          配置
        </Button>
      </Space>
    </Card>
  );

  const renderSystemStatus = () => (
    <Card title="系统状态" style={{ marginBottom: "24px" }}>
      <Row gutter={16}>
        <Col span={6}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "32px",
                color: "#52c41a",
                marginBottom: "8px",
              }}
            >
              <CheckCircleOutlined />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {toolStats?.activeTools ||
                tools.filter((t) => t.enabled && t.lastStatus !== "error")
                  .length}
            </div>
            <div style={{ color: "#666" }}>正常运行</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "32px",
                color: "#faad14",
                marginBottom: "8px",
              }}
            >
              <ExclamationCircleOutlined />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {tools.filter((t) => !t.enabled).length}
            </div>
            <div style={{ color: "#666" }}>未激活</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "32px",
                color: "#ff4d4f",
                marginBottom: "8px",
              }}
            >
              <ExclamationCircleOutlined />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {
                tools.filter((t) => t.enabled && t.lastStatus === "error")
                  .length
              }
            </div>
            <div style={{ color: "#666" }}>连接异常</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "32px",
                color: "#1890ff",
                marginBottom: "8px",
              }}
            >
              <ApiOutlined />
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>
              {toolStats?.totalTools || tools.length}
            </div>
            <div style={{ color: "#666" }}>总计工具</div>
          </div>
        </Col>
      </Row>
    </Card>
  );

  const renderUsageStats = () => (
    <Card title="使用统计" style={{ marginBottom: "24px" }}>
      {toolStats && (
        <div style={{ marginBottom: "16px" }}>
          <Row gutter={16}>
            <Col span={8}>
              <div
                style={{
                  textAlign: "center",
                  padding: "16px",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#1890ff",
                  }}
                >
                  {toolStats.totalExecutions}
                </div>
                <div style={{ color: "#666" }}>总执行次数</div>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  textAlign: "center",
                  padding: "16px",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#52c41a",
                  }}
                >
                  {(toolStats.successRate * 100).toFixed(1)}%
                </div>
                <div style={{ color: "#666" }}>成功率</div>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  textAlign: "center",
                  padding: "16px",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#722ed1",
                  }}
                >
                  {toolStats.averageExecutionTime.toFixed(0)}ms
                </div>
                <div style={{ color: "#666" }}>平均响应时间</div>
              </div>
            </Col>
          </Row>
        </div>
      )}

      <List
        dataSource={toolStats?.toolUsageStats || []}
        renderItem={(stat) => {
          const tool = tools.find((t) => t.id === stat.toolId);
          return (
            <List.Item>
              <List.Item.Meta
                avatar={tool ? getTypeIcon(tool.toolType) : <ApiOutlined />}
                title={stat.toolName}
                description={`执行 ${stat.executionCount} 次 · 成功 ${stat.successCount} 次 · 平均 ${stat.averageTime}ms`}
              />
              <Tag
                color={
                  tool
                    ? getStatusColor(tool.enabled, tool.lastStatus)
                    : "default"
                }
              >
                {tool ? getStatusText(tool.enabled, tool.lastStatus) : "未知"}
              </Tag>
            </List.Item>
          );
        }}
      />
    </Card>
  );

  if (toolsLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (toolsError) {
    return (
      <Alert
        message="加载失败"
        description="无法加载工具列表，请检查网络连接或稍后重试。"
        type="error"
        showIcon
        action={
          <Button
            size="small"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["tools"] })
            }
          >
            重试
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <Title level={2}>工具集成管理</Title>
        <Paragraph>
          管理和配置与CDN AI
          Agent集成的外部工具，包括监控系统、日志平台和API接口。
        </Paragraph>
      </div>

      {renderSystemStatus()}

      <Tabs defaultActiveKey="tools">
        <TabPane tab="工具列表" key="tools">
          <div style={{ marginBottom: "16px" }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                添加工具
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["tools"] });
                  queryClient.invalidateQueries({ queryKey: ["toolStats"] });
                }}
                loading={toolsLoading}
              >
                刷新状态
              </Button>
            </Space>
          </div>

          {tools.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px" }}>
              <ApiOutlined
                style={{
                  fontSize: "48px",
                  color: "#ccc",
                  marginBottom: "16px",
                }}
              />
              <div style={{ color: "#666" }}>
                暂无工具，点击上方按钮添加新工具
              </div>
            </div>
          ) : (
            <Row gutter={[16, 16]}>
              {tools.map((tool) => (
                <Col key={tool.id} span={12}>
                  {renderToolCard(tool)}
                </Col>
              ))}
            </Row>
          )}
        </TabPane>

        <TabPane tab="使用统计" key="stats">
          {renderUsageStats()}
        </TabPane>

        <TabPane tab="执行历史" key="history">
          <Card title="最近执行记录">
            <List
              dataSource={executionsData?.data || []}
              renderItem={(execution: ToolExecution) => {
                const tool = tools.find((t) => t.id === execution.toolId);
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        tool ? getTypeIcon(tool.toolType) : <ApiOutlined />
                      }
                      title={
                        <Space>
                          <span>
                            {tool?.displayName || tool?.name || "未知工具"}
                          </span>
                          <Tag
                            color={
                              execution.status === "success"
                                ? "success"
                                : execution.status === "failed"
                                  ? "error"
                                  : "processing"
                            }
                          >
                            {execution.status === "success"
                              ? "成功"
                              : execution.status === "failed"
                                ? "失败"
                                : "执行中"}
                          </Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>
                            执行时间:{" "}
                            {new Date(execution.executedAt).toLocaleString(
                              "zh-CN",
                            )}
                          </div>
                          {execution.duration && (
                            <div>耗时: {execution.duration}ms</div>
                          )}
                          {execution.error && (
                            <div style={{ color: "#ff4d4f" }}>
                              错误: {execution.error}
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </TabPane>
      </Tabs>

      <CreateToolModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["tools"] });
          queryClient.invalidateQueries({ queryKey: ["toolStats"] });
        }}
      />

      <Modal
        title={`配置 - ${selectedTool?.displayName || selectedTool?.name}`}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => {
          setConfigModalVisible(false);
          setSelectedTool(null);
          form.resetFields();
        }}
        confirmLoading={updateToolMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="显示名称"
            name="displayName"
            rules={[{ required: true, message: "请输入显示名称" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider>工具配置</Divider>

          {/* 编辑弹窗内的测试按钮 */}
          {selectedTool && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 8,
              }}
            >
              <Button
                icon={<ReloadOutlined />}
                onClick={handleTestConfigInModal}
                loading={testInEditMutation.isPending}
              >
                测试连接
              </Button>
            </div>
          )}

          {selectedTool && editTestPreview && (
            <Card size="small" style={{ marginBottom: 12 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span>
                    耗时: <b>{editTestPreview.responseTime ?? 0} ms</b>
                  </span>
                  <span>
                    可用工具数: <b>{editTestPreview.toolCount ?? 0}</b>
                  </span>
                </div>
                {editTestPreview.server && (
                  <Collapse size="small" destroyInactivePanel>
                    <Collapse.Panel header="MCP Server 信息" key="server">
                      <pre
                        style={{
                          background: "#f7f7f7",
                          padding: 8,
                          borderRadius: 6,
                          overflow: "auto",
                        }}
                      >
                        {JSON.stringify(editTestPreview.server, null, 2)}
                      </pre>
                    </Collapse.Panel>
                  </Collapse>
                )}
                {editTestPreview.tools &&
                  Array.isArray(editTestPreview.tools) &&
                  editTestPreview.tools.length > 0 && (
                    <Collapse size="small" destroyInactivePanel>
                      {editTestPreview.tools.map((t, idx) => (
                        <Collapse.Panel
                          header={`${t.name || "(unknown)"} - ${t.description || ""}`}
                          key={String(idx)}
                        >
                          {t.inputSchema ? (
                            <>
                              <div style={{ marginBottom: 6 }}>
                                输入参数(JSONSchema):
                              </div>
                              <pre
                                style={{
                                  background: "#f7f7f7",
                                  padding: 8,
                                  borderRadius: 6,
                                  overflow: "auto",
                                }}
                              >
                                {JSON.stringify(t.inputSchema, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <span style={{ color: "#999" }}>无参数定义</span>
                          )}
                        </Collapse.Panel>
                      ))}
                    </Collapse>
                  )}
              </Space>
            </Card>
          )}

          {selectedTool?.toolType === "mcp" ? (
            <>
              <Form.Item
                label="协议"
                name="protocol"
                rules={[{ required: true, message: "请选择协议" }]}
              >
                <Select
                  options={[
                    { label: "HTTP Streamable", value: "http_streamable" },
                    { label: "SSE", value: "sse" },
                    { label: "STDIO", value: "stdio" },
                  ]}
                  onChange={(v) => setEditMcpProtocol(v)}
                />
              </Form.Item>

              {(editMcpProtocol === "http_streamable" ||
                editMcpProtocol === "sse") && (
                <>
                  <Form.Item
                    label="Endpoint"
                    name="endpoint"
                    rules={[{ required: true, message: "请输入 Endpoint" }]}
                  >
                    <Input placeholder="如：https://api.host/v1/mcp/http-streamable/xxxx 或 https://api.host/v1/mcp/sse" />
                  </Form.Item>
                  <Form.Item
                    label="Headers"
                    name="headersText"
                    tooltip="每行一个Header，例如 Authorization: Bearer xxx"
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder={
                        "Authorization: Bearer <token>\nX-Custom-Header: value"
                      }
                    />
                  </Form.Item>
                  <Form.Item label="超时(秒)" name="timeout">
                    <Input type="number" placeholder="默认15" />
                  </Form.Item>
                  <Form.Item label="工具白名单(逗号分隔)" name="allowTools">
                    <Input placeholder="留空表示全部，例如 time.now,time.convert" />
                  </Form.Item>
                </>
              )}

              {editMcpProtocol === "stdio" && (
                <>
                  <Form.Item
                    label="命令"
                    name="command"
                    rules={[{ required: true, message: "请输入命令路径" }]}
                  >
                    <Input placeholder="如 ./mcp-server 或 /usr/local/bin/mcp-server" />
                  </Form.Item>
                  <Form.Item label="参数" name="args">
                    <Input placeholder="空格分隔，例如 --flag value" />
                  </Form.Item>
                  <Form.Item
                    label="环境变量"
                    name="envText"
                    tooltip="每行或用分号分隔，例如 FOO=bar;TOKEN=xxx"
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder={"FOO=bar\nTOKEN=xxx"}
                    />
                  </Form.Item>
                </>
              )}
            </>
          ) : (
            selectedTool && (
              <>
                {Object.entries(selectedTool.config || {}).map(
                  ([key, value]) => (
                    <Form.Item key={key} label={key} name={key}>
                      {typeof value === "boolean" ? (
                        <Switch />
                      ) : typeof value === "number" ? (
                        <Input type="number" />
                      ) : key.toLowerCase().includes("password") ||
                        key.toLowerCase().includes("secret") ||
                        key.toLowerCase().includes("key") ? (
                        <Input.Password />
                      ) : (
                        <Input />
                      )}
                    </Form.Item>
                  ),
                )}
              </>
            )
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ToolsPage;
