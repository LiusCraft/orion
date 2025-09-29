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
  Divider,
  message,
  Spin
} from 'antd'
import { 
  SendOutlined, 
  UserOutlined, 
  RobotOutlined, 
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
  BookOutlined,
  ToolOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatService } from '../../services/chatService'
import type { Message as MessageType } from '../../types'

const { TextArea } = Input
const { Text } = Typography

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

const ChatPage: React.FC = () => {
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [sseConnection] = useState<EventSource | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)
  const queryClient = useQueryClient()

  // 获取对话列表
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatService.getConversations(1, 50)
  })

  // 获取当前对话的消息
  const { data: currentConversation, isLoading: messagesLoading } = useQuery({
    queryKey: ['conversation', currentConversationId],
    queryFn: () => currentConversationId ? chatService.getConversation(currentConversationId) : null,
    enabled: !!currentConversationId
  })

  // 创建新对话
  const createConversationMutation = useMutation({
    mutationFn: chatService.createConversation,
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setCurrentConversationId(conversation.id)
      message.success('创建新对话成功')
    },
    onError: () => {
      message.error('创建对话失败')
    }
  })

  // 发送消息
  const sendMessageMutation = useMutation({
    mutationFn: (data: { conversationId: string, content: string }) => 
      chatService.sendMessage(data.conversationId, { content: data.content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', currentConversationId] })
      setInputValue('')
    },
    onError: () => {
      message.error('发送消息失败')
    }
  })

  // 删除对话
  const deleteConversationMutation = useMutation({
    mutationFn: chatService.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (currentConversationId === currentConversationId) {
        setCurrentConversationId(null)
      }
      message.success('删除对话成功')
    },
    onError: () => {
      message.error('删除对话失败')
    }
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [currentConversation?.messages?.data])

  // 初始化：如果没有对话且有对话列表，选择第一个
  useEffect(() => {
    if (!currentConversationId && conversationsData?.data && conversationsData.data.length > 0) {
      setCurrentConversationId(conversationsData.data[0].id)
    }
  }, [conversationsData, currentConversationId])

  // SSE连接处理
  useEffect(() => {
    if (!currentConversationId) return

    // 清理之前的连接
    if (sseConnection) {
      sseConnection.close()
    }

    // 注意：这里暂时不启用SSE，因为需要后端支持
    // const eventSource = chatService.createChatStream(currentConversationId, { content: '' })
    // setSseConnection(eventSource)

    // return () => {
    //   if (eventSource) {
    //     eventSource.close()
    //   }
    // }
  }, [currentConversationId])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !currentConversationId) return

    setIsLoading(true)
    
    try {
      await sendMessageMutation.mutateAsync({
        conversationId: currentConversationId,
        content: inputValue.trim()
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewConversation = () => {
    createConversationMutation.mutate('新对话')
  }

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversationMutation.mutate(conversationId)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const conversationMenuItems = [
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除对话',
      danger: true,
    }
  ]

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const renderMessage = (message: MessageType) => {
    const isUser = message.senderType === 'user'
    
    return (
      <div key={message.id} style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          gap: '12px',
          flexDirection: isUser ? 'row-reverse' : 'row'
        }}>
          <Avatar 
            size={32}
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{ 
              backgroundColor: isUser ? '#1890ff' : '#52c41a',
              flexShrink: 0 
            }}
          />
          <div style={{ 
            flex: 1, 
            maxWidth: '70%',
            textAlign: isUser ? 'right' : 'left'
          }}>
            <div style={{
              background: isUser ? '#1890ff' : '#fff',
              color: isUser ? '#fff' : '#000',
              padding: '12px 16px',
              borderRadius: '12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              marginBottom: '4px',
              whiteSpace: 'pre-wrap'
            }}>
              {message.content}
            </div>
            
            {/* 工具调用结果 - 从 metadata 中解析 */}
            {message.metadata?.tools && Array.isArray(message.metadata.tools) ? (
              <div style={{ marginTop: '8px' }}>
                {(message.metadata.tools as ToolCall[]).map((tool: ToolCall, index: number) => (
                  <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                    <Space>
                      <ToolOutlined />
                      <Text strong>{tool.description || ''}</Text>
                    </Space>
                    {tool.result && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                        {String(tool.result)}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : null}
            
            {/* 知识库引用 - 从 metadata 中解析 */}
            {message.metadata?.references && Array.isArray(message.metadata.references) ? (
              <div style={{ marginTop: '8px' }}>
                {(message.metadata.references as Reference[]).map((ref: Reference, index: number) => (
                  <Card key={index} size="small" style={{ marginBottom: '8px' }}>
                    <Space>
                      <BookOutlined />
                      <Text strong>{ref.title || ''}</Text>
                    </Space>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                      {ref.snippet || ''}
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
            
            <div style={{ 
              fontSize: '12px', 
              color: '#999', 
              marginTop: '4px',
              textAlign: isUser ? 'right' : 'left'
            }}>
              {formatTime(message.createdAt)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const conversations = conversationsData?.data || []
  const messages = currentConversation?.messages?.data || []

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
              loading={createConversationMutation.isPending}
            >
              新对话
            </Button>
          }
          style={{ height: '100%' }}
          bodyStyle={{ padding: '12px 0', height: 'calc(100% - 57px)', overflow: 'auto' }}
        >
          <Spin spinning={conversationsLoading}>
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
                    <Dropdown 
                      menu={{ 
                        items: conversationMenuItems,
                        onClick: () => handleDeleteConversation(conv.id)
                      }} 
                      trigger={['click']}
                    >
                      <Button type="text" size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  ]}
                >
                  <List.Item.Meta
                    title={<Text ellipsis>{conv.title}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString('zh-CN') : ''}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Spin>
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
              {currentConversationId && (
                <Button 
                  type="text" 
                  size="small" 
                  icon={<ReloadOutlined />}
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['conversation', currentConversationId] })}
                />
              )}
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
            {!currentConversationId ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                flexDirection: 'column'
              }}>
                <RobotOutlined style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }} />
                <Text type="secondary">选择一个对话或创建新对话开始聊天</Text>
              </div>
            ) : messagesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
                <Spin size="large" />
              </div>
            ) : messages.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100%',
                flexDirection: 'column'
              }}>
                <RobotOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                <Text>你好！我是CDN AI Agent，专门帮助解决CDN相关的技术问题。请问有什么可以帮助您的吗？</Text>
              </div>
            ) : (
              <>
                {messages.map(renderMessage)}
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
                        <Spin size="small" />
                        <Text type="secondary" style={{ marginLeft: '8px' }}>正在思考中...</Text>
                      </div>
                    </div>
                  </div>
                )}
              </>
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
                disabled={isLoading || !currentConversationId}
                style={{ resize: 'none' }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={isLoading}
                disabled={!inputValue.trim() || !currentConversationId}
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