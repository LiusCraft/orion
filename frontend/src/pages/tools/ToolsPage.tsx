import React, { useState } from 'react'
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
  message
} from 'antd'
import { 
  ApiOutlined,
  MonitorOutlined,
  FileSearchOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  EditOutlined,
  ReloadOutlined
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

interface Tool {
  id: string
  name: string
  description: string
  type: 'monitoring' | 'logging' | 'api' | 'config'
  status: 'active' | 'inactive' | 'error'
  endpoint: string
  apiKey?: string
  lastUsed?: Date
  config: Record<string, any>
}

const ToolsPage: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([
    {
      id: '1',
      name: 'Grafana监控',
      description: '集成Grafana监控系统，查询CDN性能指标和图表',
      type: 'monitoring',
      status: 'active',
      endpoint: 'https://grafana.example.com',
      lastUsed: new Date(Date.now() - 24 * 60 * 60 * 1000),
      config: {
        organization: 'main',
        timeout: 30,
        defaultDashboard: 'cdn-overview'
      }
    },
    {
      id: '2',
      name: 'Prometheus查询',
      description: '直接查询Prometheus指标数据',
      type: 'monitoring',
      status: 'active',
      endpoint: 'https://prometheus.example.com',
      lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
      config: {
        queryTimeout: 60,
        maxSamples: 50000
      }
    },
    {
      id: '3',
      name: 'ELK日志检索',
      description: '集成ELK Stack进行日志搜索和分析',
      type: 'logging',
      status: 'inactive',
      endpoint: 'https://elk.example.com',
      config: {
        index: 'cdn-logs-*',
        defaultTimeRange: '1h'
      }
    },
    {
      id: '4',
      name: 'CDN API',
      description: 'CDN平台管理API，支持配置查询和修改',
      type: 'api',
      status: 'error',
      endpoint: 'https://api.cdn.example.com',
      config: {
        version: 'v2',
        rateLimitPerMinute: 100
      }
    }
  ])

  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [form] = Form.useForm()

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'monitoring': return <MonitorOutlined />
      case 'logging': return <FileSearchOutlined />
      case 'api': return <ApiOutlined />
      case 'config': return <SettingOutlined />
      default: return <ApiOutlined />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'inactive': return 'default'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '正常'
      case 'inactive': return '未激活'
      case 'error': return '错误'
      default: return '未知'
    }
  }

  const handleToolToggle = (toolId: string, checked: boolean) => {
    setTools(prevTools => 
      prevTools.map(tool => 
        tool.id === toolId 
          ? { ...tool, status: checked ? 'active' : 'inactive' }
          : tool
      )
    )
    message.success(checked ? '工具已启用' : '工具已禁用')
  }

  const handleConfigTool = (tool: Tool) => {
    setSelectedTool(tool)
    form.setFieldsValue({
      name: tool.name,
      description: tool.description,
      endpoint: tool.endpoint,
      ...tool.config
    })
    setConfigModalVisible(true)
  }

  const handleTestConnection = async (tool: Tool) => {
    message.loading({ content: '正在测试连接...', key: 'test' })
    
    // 模拟连接测试
    setTimeout(() => {
      const success = Math.random() > 0.3
      if (success) {
        message.success({ content: '连接测试成功', key: 'test' })
        setTools(prevTools => 
          prevTools.map(t => 
            t.id === tool.id 
              ? { ...t, status: 'active' }
              : t
          )
        )
      } else {
        message.error({ content: '连接测试失败', key: 'test' })
        setTools(prevTools => 
          prevTools.map(t => 
            t.id === tool.id 
              ? { ...t, status: 'error' }
              : t
          )
        )
      }
    }, 2000)
  }

  const handleSaveConfig = () => {
    form.validateFields().then(values => {
      if (selectedTool) {
        setTools(prevTools => 
          prevTools.map(tool => 
            tool.id === selectedTool.id 
              ? { 
                  ...tool, 
                  name: values.name,
                  description: values.description,
                  endpoint: values.endpoint,
                  config: {
                    ...tool.config,
                    ...values
                  }
                }
              : tool
          )
        )
        message.success('配置已保存')
        setConfigModalVisible(false)
        setSelectedTool(null)
        form.resetFields()
      }
    })
  }

  const renderToolCard = (tool: Tool) => (
    <Card
      key={tool.id}
      title={
        <Space>
          {getTypeIcon(tool.type)}
          <span>{tool.name}</span>
          <Badge 
            status={getStatusColor(tool.status) as any} 
            text={getStatusText(tool.status)} 
          />
        </Space>
      }
      extra={
        <Space>
          <Switch
            checked={tool.status === 'active'}
            onChange={(checked) => handleToolToggle(tool.id, checked)}
            checkedChildren="启用"
            unCheckedChildren="禁用"
          />
          <Button 
            type="text" 
            icon={<EditOutlined />}
            onClick={() => handleConfigTool(tool)}
          />
        </Space>
      }
      style={{ marginBottom: '16px' }}
    >
      <Paragraph ellipsis={{ rows: 2 }}>{tool.description}</Paragraph>
      
      <Descriptions size="small" column={1}>
        <Descriptions.Item label="接口地址">
          <Text code copyable>{tool.endpoint}</Text>
        </Descriptions.Item>
        {tool.lastUsed && (
          <Descriptions.Item label="最后使用">
            {tool.lastUsed.toLocaleString('zh-CN')}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider style={{ margin: '12px 0' }} />

      <Space>
        <Button 
          type="primary" 
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => handleTestConnection(tool)}
          disabled={tool.status === 'inactive'}
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
  )

  const renderSystemStatus = () => (
    <Card title="系统状态" style={{ marginBottom: '24px' }}>
      <Row gutter={16}>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', color: '#52c41a', marginBottom: '8px' }}>
              <CheckCircleOutlined />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {tools.filter(t => t.status === 'active').length}
            </div>
            <div style={{ color: '#666' }}>正常运行</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', color: '#faad14', marginBottom: '8px' }}>
              <ExclamationCircleOutlined />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {tools.filter(t => t.status === 'inactive').length}
            </div>
            <div style={{ color: '#666' }}>未激活</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', color: '#ff4d4f', marginBottom: '8px' }}>
              <ExclamationCircleOutlined />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {tools.filter(t => t.status === 'error').length}
            </div>
            <div style={{ color: '#666' }}>连接异常</div>
          </div>
        </Col>
        <Col span={6}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', color: '#1890ff', marginBottom: '8px' }}>
              <ApiOutlined />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {tools.length}
            </div>
            <div style={{ color: '#666' }}>总计工具</div>
          </div>
        </Col>
      </Row>
    </Card>
  )

  const renderUsageStats = () => (
    <Card title="使用统计" style={{ marginBottom: '24px' }}>
      <List
        dataSource={tools.filter(t => t.lastUsed).sort((a, b) => 
          (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0)
        )}
        renderItem={(tool) => (
          <List.Item>
            <List.Item.Meta
              avatar={getTypeIcon(tool.type)}
              title={tool.name}
              description={`最后使用: ${tool.lastUsed?.toLocaleString('zh-CN')}`}
            />
            <Tag color={getStatusColor(tool.status)}>
              {getStatusText(tool.status)}
            </Tag>
          </List.Item>
        )}
      />
    </Card>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>工具集成管理</Title>
        <Paragraph>
          管理和配置与CDN AI Agent集成的外部工具，包括监控系统、日志平台和API接口。
        </Paragraph>
      </div>

      {renderSystemStatus()}

      <Tabs defaultActiveKey="tools">
        <TabPane tab="工具列表" key="tools">
          <div style={{ marginBottom: '16px' }}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />}>
                添加工具
              </Button>
              <Button icon={<ReloadOutlined />}>
                刷新状态
              </Button>
            </Space>
          </div>

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Title level={4}>监控工具</Title>
              {tools.filter(t => t.type === 'monitoring').map(renderToolCard)}
            </Col>
            <Col span={12}>
              <Title level={4}>日志工具</Title>
              {tools.filter(t => t.type === 'logging').map(renderToolCard)}
              
              <Title level={4} style={{ marginTop: '24px' }}>API工具</Title>
              {tools.filter(t => t.type === 'api').map(renderToolCard)}
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="使用统计" key="stats">
          {renderUsageStats()}
        </TabPane>

        <TabPane tab="系统配置" key="config">
          <Card title="全局配置">
            <Form layout="vertical">
              <Form.Item label="API调用超时时间(秒)" name="globalTimeout">
                <Input placeholder="30" />
              </Form.Item>
              <Form.Item label="最大并发连接数" name="maxConnections">
                <Input placeholder="10" />
              </Form.Item>
              <Form.Item label="重试次数" name="retryCount">
                <Input placeholder="3" />
              </Form.Item>
              <Form.Item>
                <Button type="primary">保存配置</Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={`配置 - ${selectedTool?.name}`}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => {
          setConfigModalVisible(false)
          setSelectedTool(null)
          form.resetFields()
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            label="工具名称" 
            name="name" 
            rules={[{ required: true, message: '请输入工具名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item 
            label="描述" 
            name="description"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item 
            label="接口地址" 
            name="endpoint"
            rules={[{ required: true, message: '请输入接口地址' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="API密钥" name="apiKey">
            <Input.Password placeholder="如需要请输入API密钥" />
          </Form.Item>
          
          {selectedTool?.type === 'monitoring' && (
            <>
              <Form.Item label="组织" name="organization">
                <Input />
              </Form.Item>
              <Form.Item label="超时时间(秒)" name="timeout">
                <Input type="number" />
              </Form.Item>
            </>
          )}
          
          {selectedTool?.type === 'logging' && (
            <>
              <Form.Item label="索引模式" name="index">
                <Input />
              </Form.Item>
              <Form.Item label="默认时间范围" name="defaultTimeRange">
                <Input />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default ToolsPage