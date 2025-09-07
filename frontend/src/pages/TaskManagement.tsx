import React, { useState } from 'react'
import { 
  Table, 
  Card, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Select, 
  DatePicker,
  message 
} from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { GuardDutyTask } from '../types'

const { Option } = Select
const { RangePicker } = DatePicker

const TaskManagement: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [searchText, setSearchText] = useState('')

  const tasks: GuardDutyTask[] = [
    {
      id: '1',
      name: '用户服务发布保障',
      application: 'user-service',
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
      duration: 30,
      metrics: [],
      alerts: [],
      deploymentId: 'DEP-2024-001',
      createdBy: '张三'
    },
    {
      id: '2',
      name: '订单服务配置变更',
      application: 'order-service',
      status: 'warning',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      duration: 45,
      metrics: [],
      alerts: [
        {
          id: 'alert-1',
          severity: 'P1',
          message: '响应时间超过阈值',
          timestamp: new Date().toISOString(),
          acknowledged: false,
          source: 'Prometheus',
          metricName: 'response_time'
        }
      ],
      createdBy: '李四'
    },
    {
      id: '3',
      name: '支付服务紧急修复',
      application: 'payment-service',
      status: 'completed',
      startTime: new Date(Date.now() - 86400000).toISOString(),
      endTime: new Date(Date.now() - 82800000).toISOString(),
      duration: 60,
      metrics: [],
      alerts: [],
      deploymentId: 'DEP-2024-002',
      createdBy: '王五'
    }
  ]

  const getStatusTag = (status: string) => {
    const statusConfig = {
      running: { color: 'blue', text: '运行中' },
      completed: { color: 'green', text: '已完成' },
      warning: { color: 'orange', text: '警告' },
      critical: { color: 'red', text: '严重' }
    }
    const config = statusConfig[status as keyof typeof statusConfig]
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: GuardDutyTask) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.application}
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    {
      title: '持续时间',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => `${duration}分钟`
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      key: 'createdBy'
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record: GuardDutyTask) => (
        <Space size="middle">
          <a>查看</a>
          <a>编辑</a>
          {record.status === 'running' && <a style={{ color: '#ff4d4f' }}>终止</a>}
        </Space>
      )
    }
  ]

  const showCreateModal = () => {
    setIsModalVisible(true)
  }

  const handleCreate = () => {
    message.success('任务创建成功')
    setIsModalVisible(false)
  }

  const handleCancel = () => {
    setIsModalVisible(false)
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        {/* 搜索和操作栏 */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="搜索任务名称或应用"
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Select placeholder="状态筛选" style={{ width: 120 }} allowClear>
              <Option value="running">运行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="warning">警告</Option>
              <Option value="critical">严重</Option>
            </Select>
            <RangePicker showTime />
          </Space>

          <Button type="primary" icon={<PlusOutlined />} onClick={showCreateModal}>
            新建任务
          </Button>
        </div>

        {/* 任务表格 */}
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
        />
      </Card>

      {/* 创建任务模态框 */}
      <Modal
        title="新建保障任务"
        open={isModalVisible}
        onOk={handleCreate}
        onCancel={handleCancel}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="任务名称" required>
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          
          <Form.Item label="应用服务" required>
            <Select placeholder="请选择应用服务">
              <Option value="user-service">用户服务</Option>
              <Option value="order-service">订单服务</Option>
              <Option value="payment-service">支付服务</Option>
            </Select>
          </Form.Item>

          <Form.Item label="关联发布单">
            <Input placeholder="请输入发布单ID" />
          </Form.Item>

          <Form.Item label="监控时长" required>
            <Select defaultValue="60">
              <Option value="30">30分钟</Option>
              <Option value="60">60分钟</Option>
              <Option value="120">120分钟</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>

          <Form.Item label="监控指标">
            <Select mode="multiple" placeholder="选择监控指标">
              <Option value="error_rate">错误率</Option>
              <Option value="response_time">响应时间</Option>
              <Option value="qps">QPS</Option>
              <Option value="cpu">CPU使用率</Option>
              <Option value="memory">内存使用率</Option>
            </Select>
          </Form.Item>

          <Form.Item label="通知渠道">
            <Select mode="multiple" defaultValue={['dingtalk']}>
              <Option value="dingtalk">钉钉</Option>
              <Option value="sms">短信</Option>
              <Option value="email">邮件</Option>
              <Option value="phone">电话</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default TaskManagement