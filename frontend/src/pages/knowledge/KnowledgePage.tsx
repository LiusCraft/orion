import React, { useState } from 'react'
import { 
  Card, 
  Typography, 
  Row, 
  Col, 
  Tree, 
  Button, 
  Space, 
  Input, 
  Table, 
  Tag, 
  Modal, 
  Form, 
  Select, 
  Upload, 
  message,
  Tabs,
  List,
  Avatar,
  Divider,
  Statistic
} from 'antd'
import { 
  FileTextOutlined, 
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  StarOutlined,
  StarFilled,
  UserOutlined,
  ClockCircleOutlined,
  BookOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { TabPane } = Tabs
const { Option } = Select

interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  author: string
  createdAt: Date
  updatedAt: Date
  version: string
  status: 'draft' | 'published' | 'archived'
  views: number
  likes: number
  size: number
  type: 'document' | 'tutorial' | 'faq' | 'guide'
  isStarred?: boolean
}

interface Category {
  key: string
  title: string
  children?: Category[]
}

const KnowledgePage: React.FC = () => {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([
    {
      id: '1',
      title: 'CDN基础配置指南',
      content: 'CDN配置的基础知识和最佳实践...',
      category: 'configuration',
      tags: ['配置', '基础', '入门'],
      author: '张三',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-20'),
      version: 'v1.2',
      status: 'published',
      views: 1250,
      likes: 45,
      size: 15600,
      type: 'guide',
      isStarred: true
    },
    {
      id: '2',
      title: '缓存策略优化',
      content: '如何优化CDN缓存策略以提升性能...',
      category: 'optimization',
      tags: ['缓存', '性能', '优化'],
      author: '李四',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
      version: 'v1.0',
      status: 'published',
      views: 856,
      likes: 32,
      size: 12300,
      type: 'tutorial'
    },
    {
      id: '3',
      title: '常见故障排查FAQ',
      content: 'CDN常见问题的快速解决方案...',
      category: 'troubleshooting',
      tags: ['故障', 'FAQ', '排查'],
      author: '王五',
      createdAt: new Date('2024-01-28'),
      updatedAt: new Date('2024-02-05'),
      version: 'v1.1',
      status: 'published',
      views: 2100,
      likes: 78,
      size: 8900,
      type: 'faq'
    },
    {
      id: '4',
      title: 'HTTPS配置完整教程',
      content: '从零开始配置CDN的HTTPS支持...',
      category: 'security',
      tags: ['HTTPS', '安全', '证书'],
      author: '赵六',
      createdAt: new Date('2024-02-10'),
      updatedAt: new Date('2024-02-10'),
      version: 'v1.0',
      status: 'draft',
      views: 0,
      likes: 0,
      size: 18700,
      type: 'tutorial'
    }
  ])

  const [categories] = useState<Category[]>([
    {
      key: 'configuration',
      title: '配置管理',
      children: [
        { key: 'basic-config', title: '基础配置' },
        { key: 'advanced-config', title: '高级配置' }
      ]
    },
    {
      key: 'optimization',
      title: '性能优化',
      children: [
        { key: 'cache-optimization', title: '缓存优化' },
        { key: 'network-optimization', title: '网络优化' }
      ]
    },
    {
      key: 'security',
      title: '安全管理',
      children: [
        { key: 'ssl-config', title: 'SSL配置' },
        { key: 'access-control', title: '访问控制' }
      ]
    },
    {
      key: 'troubleshooting',
      title: '故障排查',
      children: [
        { key: 'common-issues', title: '常见问题' },
        { key: 'monitoring', title: '监控告警' }
      ]
    }
  ])

  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchText, setSearchText] = useState('')
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)
  const [form] = Form.useForm()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'success'
      case 'draft': return 'warning'
      case 'archived': return 'default'
      default: return 'default'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'published': return '已发布'
      case 'draft': return '草稿'
      case 'archived': return '已归档'
      default: return '未知'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileTextOutlined />
      case 'tutorial': return <BookOutlined />
      case 'faq': return <QuestionCircleOutlined />
      case 'guide': return <BookOutlined />
      default: return <FileTextOutlined />
    }
  }

  const filteredItems = knowledgeItems.filter(item => {
    const matchesCategory = !selectedCategory || item.category === selectedCategory
    const matchesSearch = !searchText || 
      item.title.toLowerCase().includes(searchText.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  const handleStarToggle = (itemId: string) => {
    setKnowledgeItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, isStarred: !item.isStarred }
          : item
      )
    )
  }

  const handleEdit = (item: KnowledgeItem) => {
    setSelectedItem(item)
    form.setFieldsValue({
      title: item.title,
      content: item.content,
      category: item.category,
      tags: item.tags,
      type: item.type,
      status: item.status
    })
    setEditModalVisible(true)
  }

  const handlePreview = (item: KnowledgeItem) => {
    setSelectedItem(item)
    setPreviewModalVisible(true)
  }

  const handleDelete = (itemId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个知识条目吗？此操作不可恢复。',
      onOk: () => {
        setKnowledgeItems(prev => prev.filter(item => item.id !== itemId))
        message.success('删除成功')
      }
    })
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: KnowledgeItem) => (
        <Space>
          {getTypeIcon(record.type)}
          <span 
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => handlePreview(record)}
          >
            {text}
          </span>
          {record.isStarred && <StarFilled style={{ color: '#faad14' }} />}
        </Space>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const categoryObj = categories.find(c => c.key === category)
        return <Tag>{categoryObj?.title || category}</Tag>
      }
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {getStatusText(status)}
        </Tag>
      )
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author'
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: Date) => date.toLocaleDateString('zh-CN')
    },
    {
      title: '查看次数',
      dataIndex: 'views',
      key: 'views'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: KnowledgeItem) => (
        <Space>
          <Button 
            type="text" 
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          />
          <Button 
            type="text" 
            icon={record.isStarred ? <StarFilled /> : <StarOutlined />}
            onClick={() => handleStarToggle(record.id)}
            style={{ color: record.isStarred ? '#faad14' : undefined }}
          />
          <Button 
            type="text" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Button 
            type="text" 
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      )
    }
  ]

  const renderStats = () => (
    <Row gutter={16} style={{ marginBottom: '24px' }}>
      <Col span={6}>
        <Card>
          <Statistic 
            title="总文档数" 
            value={knowledgeItems.length} 
            prefix={<BookOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic 
            title="已发布" 
            value={knowledgeItems.filter(item => item.status === 'published').length}
            valueStyle={{ color: '#3f8600' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic 
            title="总阅读量" 
            value={knowledgeItems.reduce((sum, item) => sum + item.views, 0)}
            prefix={<EyeOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic 
            title="收藏数" 
            value={knowledgeItems.filter(item => item.isStarred).length}
            prefix={<StarOutlined />}
          />
        </Card>
      </Col>
    </Row>
  )

  const renderRecentActivity = () => (
    <Card title="最近活动" style={{ marginBottom: '24px' }}>
      <List
        dataSource={knowledgeItems
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, 5)
        }
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar icon={getTypeIcon(item.type)} />}
              title={
                <Space>
                  <span>{item.title}</span>
                  <Tag color={getStatusColor(item.status)}>
                    {getStatusText(item.status)}
                  </Tag>
                </Space>
              }
              description={
                <Space>
                  <Text type="secondary">
                    <UserOutlined /> {item.author}
                  </Text>
                  <Divider type="vertical" />
                  <Text type="secondary">
                    <ClockCircleOutlined /> {item.updatedAt.toLocaleDateString('zh-CN')}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>知识库管理</Title>
        <Paragraph>
          管理CDN相关的技术文档、教程和最佳实践，为AI助手提供准确的知识支撑。
        </Paragraph>
      </div>

      <Tabs defaultActiveKey="manage">
        <TabPane tab="文档管理" key="manage">
          {renderStats()}

          <Row gutter={16} style={{ marginBottom: '16px' }}>
            <Col span={16}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />}>
                  新建文档
                </Button>
                <Upload>
                  <Button icon={<UploadOutlined />}>批量导入</Button>
                </Upload>
                <Button icon={<DownloadOutlined />}>导出</Button>
              </Space>
            </Col>
            <Col span={8}>
              <Search
                placeholder="搜索文档标题或标签"
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Card title="分类目录" size="small" style={{ height: '500px' }}>
                <Tree
                  treeData={categories}
                  onSelect={(keys) => setSelectedCategory(keys[0] as string)}
                  selectedKeys={selectedCategory ? [selectedCategory] : []}
                />
              </Card>
            </Col>
            <Col span={18}>
              <Card>
                <Table
                  columns={columns}
                  dataSource={filteredItems}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`
                  }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="概览统计" key="overview">
          {renderStats()}
          {renderRecentActivity()}
          
          <Row gutter={16}>
            <Col span={12}>
              <Card title="分类分布">
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">图表组件待实现</Text>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="创建趋势">
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary">图表组件待实现</Text>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="标签管理" key="tags">
          <Card title="标签统计">
            <Space wrap>
              {Array.from(new Set(knowledgeItems.flatMap(item => item.tags))).map(tag => (
                <Tag key={tag} style={{ margin: '4px' }}>
                  {tag} ({knowledgeItems.filter(item => item.tags.includes(tag)).length})
                </Tag>
              ))}
            </Space>
          </Card>
        </TabPane>
      </Tabs>

      {/* 编辑弹窗 */}
      <Modal
        title={selectedItem ? '编辑文档' : '新建文档'}
        open={editModalVisible}
        onOk={() => {
          form.validateFields().then(() => {
            message.success('保存成功')
            setEditModalVisible(false)
            form.resetFields()
          })
        }}
        onCancel={() => {
          setEditModalVisible(false)
          form.resetFields()
        }}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="title" 
            label="标题" 
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={10} placeholder="请输入文档内容..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="分类">
                <Select>
                  {categories.map(cat => (
                    <Option key={cat.key} value={cat.key}>{cat.title}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="类型">
                <Select>
                  <Option value="document">文档</Option>
                  <Option value="tutorial">教程</Option>
                  <Option value="faq">FAQ</Option>
                  <Option value="guide">指南</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tags" label="标签">
                <Select mode="tags" placeholder="添加标签">
                  <Option value="配置">配置</Option>
                  <Option value="性能">性能</Option>
                  <Option value="安全">安全</Option>
                  <Option value="故障">故障</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select>
                  <Option value="draft">草稿</Option>
                  <Option value="published">发布</Option>
                  <Option value="archived">归档</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        title={selectedItem?.title}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedItem && (
          <div>
            <Space style={{ marginBottom: '16px' }}>
              <Tag color={getStatusColor(selectedItem.status)}>
                {getStatusText(selectedItem.status)}
              </Tag>
              {selectedItem.tags.map(tag => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
            <Divider />
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {selectedItem.content}
            </div>
            <Divider />
            <Text type="secondary">
              作者: {selectedItem.author} | 
              创建: {selectedItem.createdAt.toLocaleDateString('zh-CN')} | 
              更新: {selectedItem.updatedAt.toLocaleDateString('zh-CN')} |
              查看: {selectedItem.views} 次
            </Text>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default KnowledgePage