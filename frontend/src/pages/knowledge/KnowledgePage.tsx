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
  Statistic,
  Spin
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { knowledgeService, type KnowledgeSearchParams } from '../../services/knowledgeService'
import type { KnowledgeCategory, KnowledgeDocument } from '../../types'

const { Title, Text, Paragraph } = Typography
const { Search } = Input
const { TabPane } = Tabs
const { Option } = Select

const KnowledgePage: React.FC = () => {
  const [searchParams, setSearchParams] = useState<KnowledgeSearchParams>({})
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<KnowledgeDocument | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  // 获取分类列表
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['knowledge-categories'],
    queryFn: knowledgeService.getCategories
  })

  // 搜索文档
  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['knowledge-documents', searchParams],
    queryFn: () => knowledgeService.searchDocuments(searchParams)
  })

  // 获取统计信息
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['knowledge-statistics'],
    queryFn: knowledgeService.getStatistics
  })

  // 获取最近文档
  const { data: recentDocuments } = useQuery({
    queryKey: ['knowledge-recent'],
    queryFn: () => knowledgeService.getRecentDocuments(5)
  })

  // 创建文档
  const createDocumentMutation = useMutation({
    mutationFn: knowledgeService.createDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-statistics'] })
      message.success('创建文档成功')
      setEditModalVisible(false)
      form.resetFields()
    },
    onError: () => {
      message.error('创建文档失败')
    }
  })

  // 更新文档
  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => 
      knowledgeService.updateDocument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
      message.success('更新文档成功')
      setEditModalVisible(false)
      form.resetFields()
    },
    onError: () => {
      message.error('更新文档失败')
    }
  })

  // 删除文档
  const deleteDocumentMutation = useMutation({
    mutationFn: knowledgeService.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-statistics'] })
      message.success('删除文档成功')
    },
    onError: () => {
      message.error('删除文档失败')
    }
  })

  // 点赞/取消点赞
  const toggleLikeMutation = useMutation({
    mutationFn: ({ id, isLiked }: { id: string, isLiked: boolean }) => 
      isLiked ? knowledgeService.unlikeDocument(id) : knowledgeService.likeDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-documents'] })
    }
  })

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

  const handleSearch = (keyword: string) => {
    setSearchParams(prev => ({ ...prev, keyword, page: 1 }))
  }

  const handleCategorySelect = (selectedKeys: React.Key[]) => {
    const categoryId = selectedKeys[0] as string
    setSearchParams(prev => ({ ...prev, categoryId, page: 1 }))
  }

  const handleStarToggle = (document: KnowledgeDocument) => {
    // 这里需要实现收藏功能的API
    toggleLikeMutation.mutate({ 
      id: document.id, 
      isLiked: document.likeCount > 0 // 简化判断
    })
  }

  const handleEdit = (item: KnowledgeDocument) => {
    setSelectedItem(item)
    form.setFieldsValue({
      title: item.title,
      content: item.content,
      categoryId: item.categoryId,
      tags: item.tags,
      summary: item.summary,
      status: item.status
    })
    setEditModalVisible(true)
  }

  const handlePreview = (item: KnowledgeDocument) => {
    setSelectedItem(item)
    // 增加浏览次数
    knowledgeService.incrementViewCount(item.id)
    setPreviewModalVisible(true)
  }

  const handleDelete = (itemId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个知识条目吗？此操作不可恢复。',
      onOk: () => {
        deleteDocumentMutation.mutate(itemId)
      }
    })
  }

  const handleSaveDocument = () => {
    form.validateFields().then(values => {
      if (selectedItem) {
        // 更新文档
        updateDocumentMutation.mutate({
          id: selectedItem.id,
          data: values
        })
      } else {
        // 创建文档
        createDocumentMutation.mutate(values)
      }
    })
  }

  // 构建分类树数据
  const buildCategoryTree = (categories: KnowledgeCategory[] = []): any[] => {
    return categories.map(cat => ({
      key: cat.id,
      title: cat.name,
      children: cat.children ? buildCategoryTree(cat.children) : undefined
    }))
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: KnowledgeDocument) => (
        <Space>
          {getTypeIcon(record.contentType)}
          <span 
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => handlePreview(record)}
          >
            {text}
          </span>
          <StarFilled style={{ color: '#faad14' }} />
        </Space>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category: KnowledgeCategory) => (
        <Tag>{category?.name || '未分类'}</Tag>
      )
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
      key: 'author',
      render: (author: any) => author?.displayName || '未知'
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN')
    },
    {
      title: '查看次数',
      dataIndex: 'viewCount',
      key: 'viewCount'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: KnowledgeDocument) => (
        <Space>
          <Button 
            type="text" 
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          />
          <Button 
            type="text" 
            icon={<StarOutlined />}
            onClick={() => handleStarToggle(record)}
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
            loading={deleteDocumentMutation.isPending}
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
            value={statistics?.totalDocuments || 0} 
            prefix={<BookOutlined />}
            loading={statsLoading}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic 
            title="已发布" 
            value={statistics?.publishedDocuments || 0}
            valueStyle={{ color: '#3f8600' }}
            loading={statsLoading}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic 
            title="总阅读量" 
            value={statistics?.totalViews || 0}
            prefix={<EyeOutlined />}
            loading={statsLoading}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic 
            title="总点赞数" 
            value={statistics?.totalLikes || 0}
            prefix={<StarOutlined />}
            loading={statsLoading}
          />
        </Card>
      </Col>
    </Row>
  )

  const renderRecentActivity = () => (
    <Card title="最近活动" style={{ marginBottom: '24px' }}>
      <List
        dataSource={recentDocuments || []}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar icon={getTypeIcon(item.contentType)} />}
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
                    <UserOutlined /> {item.author?.displayName || '未知'}
                  </Text>
                  <Divider type="vertical" />
                  <Text type="secondary">
                    <ClockCircleOutlined /> {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                  </Text>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )

  const documents = documentsData?.data || []
  const categoryTree = buildCategoryTree(categories)

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
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedItem(null)
                    form.resetFields()
                    setEditModalVisible(true)
                  }}
                >
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
                onSearch={handleSearch}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Card title="分类目录" size="small" style={{ height: '500px' }}>
                <Spin spinning={categoriesLoading}>
                  <Tree
                    treeData={categoryTree}
                    onSelect={handleCategorySelect}
                    selectedKeys={searchParams.categoryId ? [searchParams.categoryId] : []}
                  />
                </Spin>
              </Card>
            </Col>
            <Col span={18}>
              <Card>
                <Table
                  columns={columns}
                  dataSource={documents}
                  rowKey="id"
                  loading={documentsLoading}
                  pagination={{
                    current: searchParams.page || 1,
                    pageSize: searchParams.pageSize || 20,
                    total: documentsData?.pagination.total || 0,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`,
                    onChange: (page, pageSize) => {
                      setSearchParams(prev => ({ ...prev, page, pageSize }))
                    }
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
              {Object.entries(statistics?.tagCounts || {}).map(([tag, count]) => (
                <Tag key={tag} style={{ margin: '4px' }}>
                  {tag} ({count})
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
        onOk={handleSaveDocument}
        onCancel={() => {
          setEditModalVisible(false)
          form.resetFields()
          setSelectedItem(null)
        }}
        confirmLoading={createDocumentMutation.isPending || updateDocumentMutation.isPending}
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
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={3} placeholder="请输入文档摘要..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="categoryId" label="分类">
                <Select placeholder="选择分类">
                  {categories?.map(cat => (
                    <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contentType" label="类型">
                <Select placeholder="选择类型">
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
                <Select placeholder="选择状态">
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
              作者: {selectedItem.author?.displayName || '未知'} | 
              创建: {new Date(selectedItem.createdAt).toLocaleDateString('zh-CN')} | 
              更新: {new Date(selectedItem.updatedAt).toLocaleDateString('zh-CN')} |
              查看: {selectedItem.viewCount} 次
            </Text>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default KnowledgePage