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

  const handleSubmit = (
    values: CreateToolRequest & Record<string, unknown>,
  ) => {
    const { name, displayName, description, toolType, ...config } = values;
    createToolMutation.mutate({
      name,
      displayName,
      description,
      toolType,
      config,
      enabled: true,
    });
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    if (toolTemplate) {
      form.setFieldsValue(toolTemplate.defaultConfig);
    }
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

        {selectedType && toolTemplate && (
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
    form.setFieldsValue({
      displayName: tool.displayName,
      description: tool.description,
      ...tool.config,
    });
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
        const { displayName, description, ...config } = values;
        updateToolMutation.mutate({
          toolId: selectedTool.id,
          data: {
            displayName,
            description,
            config,
          },
        });
        setConfigModalVisible(false);
        setSelectedTool(null);
        form.resetFields();
      }
    });
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

          {/* 动态渲染配置字段 */}
          {selectedTool &&
            Object.entries(selectedTool.config || {}).map(([key, value]) => (
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
            ))}
        </Form>
      </Modal>
    </div>
  );
};

export default ToolsPage;
