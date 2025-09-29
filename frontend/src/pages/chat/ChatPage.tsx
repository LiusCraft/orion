import React, { useState, useRef, useEffect } from 'react'
import { 
  Card, 
  Input, 
  Button, 
  Space, 
  Avatar, 
  List, 
  Typography, 
  Badge,
  Dropdown,
  Divider
} from 'antd'
import { 
  SendOutlined, 
  UserOutlined, 
  RobotOutlined, 
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
  BookOutlined,
  ToolOutlined
} from '@ant-design/icons'

const { TextArea } = Input
const { Text } = Typography

interface Message {
  id: string
  content: string
  type: 'user' | 'assistant'
  timestamp: Date
  tools?: ToolCall[]
  references?: Reference[]
}

interface ToolCall {
  name: string
  description: string
  result?: string
}

interface Reference {
  title: string
  url: string
  snippet: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  updatedAt: Date
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '你好！我是CDN AI Agent，专门帮助解决CDN相关的技术问题。请问有什么可以帮助您的吗？',
      type: 'assistant',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: '新对话',
      messages: [],
      updatedAt: new Date()
    }
  ])
  const [currentConversationId, setCurrentConversationId] = useState('1')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      type: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // 模拟AI响应
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: generateMockResponse(inputValue),
        type: 'assistant',
        timestamp: new Date(),
        tools: inputValue.toLowerCase().includes('监控') || inputValue.toLowerCase().includes('查询') ? [
          {
            name: 'grafana_query',
            description: '查询Grafana监控数据',
            result: '查询到相关监控指标：CDN节点状态正常，带宽使用率75%'
          }
        ] : undefined,
        references: inputValue.toLowerCase().includes('配置') || inputValue.toLowerCase().includes('文档') ? [
          {
            title: 'CDN缓存策略配置指南',
            url: '/knowledge/cache-config',
            snippet: '针对不同类型的内容设置合适的缓存时间...'
          }
        ] : undefined
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  const generateMockResponse = (input: string): string => {
    const lowerInput = input.toLowerCase()
    
    if (lowerInput.includes('cdn') && lowerInput.includes('配置')) {
      return 'CDN配置需要考虑以下几个方面：\n\n1. **缓存策略**：根据内容类型设置合适的TTL\n2. **回源配置**：配置健康的源站和备用源站\n3. **安全设置**：启用HTTPS和适当的安全头\n4. **性能优化**：开启压缩和HTTP/2\n\n您具体想了解哪个方面的配置呢？'
    }
    
    if (lowerInput.includes('监控') || lowerInput.includes('性能')) {
      return '根据监控数据显示：\n\n📊 **当前状态**：\n- 节点可用性：99.9%\n- 平均响应时间：45ms\n- 带宽使用率：75%\n- 缓存命中率：92%\n\n🔍 **建议检查**：\n- 查看异常节点详情\n- 优化缓存策略提升命中率\n\n需要我帮您查看具体的监控图表吗？'
    }
    
    if (lowerInput.includes('故障') || lowerInput.includes('问题')) {
      return '让我帮您诊断CDN故障：\n\n🔧 **故障排查步骤**：\n1. 检查源站状态\n2. 验证DNS解析\n3. 测试节点连通性\n4. 查看错误日志\n\n📋 **常见问题**：\n- 5xx错误通常与源站有关\n- 缓存问题可能导致内容更新延迟\n- 网络问题影响特定区域访问\n\n请提供具体的错误信息，我可以给出更精准的解决方案。'
    }
    
    return '感谢您的咨询！我是专门处理CDN相关问题的AI助手。我可以帮您解决：\n\n🚀 **技术支持**：\n- CDN配置和优化\n- 故障诊断和排查\n- 性能监控和分析\n- 安全策略建议\n\n💡 **知识服务**：\n- 最佳实践指导\n- 技术文档查询\n- 工具使用说明\n\n请详细描述您遇到的问题，我会为您提供专业的解决方案。'
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      updatedAt: new Date()
    }
    setConversations(prev => [newConversation, ...prev])
    setCurrentConversationId(newConversation.id)
    setMessages([{
      id: '1',
      content: '你好！我是CDN AI Agent，专门帮助解决CDN相关的技术问题。请问有什么可以帮助您的吗？',
      type: 'assistant',
      timestamp: new Date()
    }])
  }

  const conversationMenuItems = [
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除对话',
      danger: true,
    }
  ]

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div style={{ height: 'calc(100vh - 112px)', display: 'flex', gap: '16px' }}>
      {/* 对话历史侧栏 */}
      <div style={{ width: '280px', flexShrink: 0 }}>
        <Card 
          title="对话历史" 
          extra={
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              size="small"
              onClick={handleNewConversation}
            >
              新对话
            </Button>
          }
          style={{ height: '100%' }}
          bodyStyle={{ padding: '12px 0', height: 'calc(100% - 57px)', overflow: 'auto' }}
        >
          <List
            dataSource={conversations}
            renderItem={(conv) => (
              <List.Item
                style={{ 
                  padding: '8px 16px',
                  cursor: 'pointer',
                  backgroundColor: conv.id === currentConversationId ? '#f0f8ff' : 'transparent',
                  borderLeft: conv.id === currentConversationId ? '3px solid #1890ff' : '3px solid transparent'
                }}
                onClick={() => setCurrentConversationId(conv.id)}
                actions={[
                  <Dropdown menu={{ items: conversationMenuItems }} trigger={['click']}>
                    <Button type="text" size="small" icon={<MoreOutlined />} />
                  </Dropdown>
                ]}
              >
                <List.Item.Meta
                  title={<Text ellipsis>{conv.title}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {conv.updatedAt.toLocaleDateString('zh-CN')}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      {/* 主对话区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Card 
          title={
            <Space>
              <RobotOutlined />
              <span>CDN AI Agent</span>
              <Badge status="processing" text="在线" />
            </Space>
          }
          style={{ height: '100%' }}
          bodyStyle={{ 
            padding: 0, 
            height: 'calc(100% - 57px)', 
            display: 'flex', 
            flexDirection: 'column' 
          }}
        >
          {/* 消息列表 */}
          <div style={{ 
            flex: 1, 
            overflow: 'auto', 
            padding: '16px 24px',
            backgroundColor: '#fafafa'
          }}>
            {messages.map((message) => (
              <div key={message.id} style={{ marginBottom: '24px' }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px',
                  flexDirection: message.type === 'user' ? 'row-reverse' : 'row'
                }}>
                  <Avatar 
                    size={32}
                    icon={message.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{ 
                      backgroundColor: message.type === 'user' ? '#1890ff' : '#52c41a',
                      flexShrink: 0 
                    }}
                  />
                  <div style={{ 
                    flex: 1, 
                    maxWidth: '70%',
                    textAlign: message.type === 'user' ? 'right' : 'left'
                  }}>
                    <div style={{
                      background: message.type === 'user' ? '#1890ff' : '#fff',
                      color: message.type === 'user' ? '#fff' : '#000',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      marginBottom: '4px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {message.content}
                    </div>
                    
                    {/* 工具调用结果 */}
                    {message.tools && (
                      <div style={{ marginTop: '8px' }}>
                        {message.tools.map((tool, index) => (
                          <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                            <Space>
                              <ToolOutlined />
                              <Text strong>{tool.description}</Text>
                            </Space>
                            {tool.result && (
                              <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                {tool.result}
                              </div>
                            )}
                          </Card>
                        ))}
                      </div>
                    )}
                    
                    {/* 知识库引用 */}
                    {message.references && (
                      <div style={{ marginTop: '8px' }}>
                        {message.references.map((ref, index) => (
                          <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                            <Space>
                              <BookOutlined />
                              <Text strong>{ref.title}</Text>
                            </Space>
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                              {ref.snippet}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                    
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#999', 
                      marginTop: '4px',
                      textAlign: message.type === 'user' ? 'right' : 'left'
                    }}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Avatar 
                    size={32}
                    icon={<RobotOutlined />}
                    style={{ backgroundColor: '#52c41a' }}
                  />
                  <div style={{
                    background: '#fff',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>
                    <Text type="secondary">正在思考中...</Text>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <Divider style={{ margin: 0 }} />

          {/* 输入框 */}
          <div style={{ padding: '16px 24px', backgroundColor: '#fff' }}>
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="请输入您的问题（Enter发送，Shift+Enter换行）"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={isLoading}
                style={{ resize: 'none' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={isLoading}
                disabled={!inputValue.trim()}
                style={{ height: 'auto' }}
              >
                发送
              </Button>
            </Space.Compact>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ChatPage