import apiClient from './apiClient'
import type { 
  Conversation, 
  Message, 
  SendMessageRequest, 
  ApiResponse, 
  PaginationResponse,
  SSEEvent 
} from '../types'

export const chatService = {
  // 获取对话列表
  async getConversations(page = 1, pageSize = 20): Promise<PaginationResponse<Conversation>> {
    const response = await apiClient.get<ApiResponse<PaginationResponse<Conversation>>>(
      `/conversations?page=${page}&pageSize=${pageSize}`
    )
    if (!response.data) {
      throw new Error('获取对话列表失败：无效的响应数据')
    }
    return response.data
  },

  // 创建新对话
  async createConversation(title?: string): Promise<Conversation> {
    const response = await apiClient.post<ApiResponse<Conversation>>('/conversations', {
      title: title || '新对话'
    })
    if (!response.data) {
      throw new Error('创建对话失败：无效的响应数据')
    }
    return response.data
  },

  // 获取对话详情和消息历史
  async getConversation(conversationId: string, page = 1, pageSize = 50): Promise<{
    conversation: Conversation
    messages: PaginationResponse<Message>
  }> {
    const [conversationResponse, messagesResponse] = await Promise.all([
      apiClient.get<ApiResponse<Conversation>>(`/conversations/${conversationId}`),
      apiClient.get<ApiResponse<PaginationResponse<Message>>>(
        `/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`
      )
    ])

    if (!conversationResponse.data || !messagesResponse.data) {
      throw new Error('获取对话详情失败：无效的响应数据')
    }

    return {
      conversation: conversationResponse.data,
      messages: messagesResponse.data
    }
  },

  // 发送消息
  async sendMessage(conversationId: string, messageData: SendMessageRequest): Promise<Message> {
    const response = await apiClient.post<ApiResponse<Message>>(
      `/conversations/${conversationId}/messages`,
      messageData
    )
    if (!response.data) {
      throw new Error('发送消息失败：无效的响应数据')
    }
    return response.data
  },

  // 创建SSE连接进行流式对话
  createChatStream(conversationId: string): EventSource {
    // 直接创建SSE连接接收流式响应，不再发送消息（消息已在前端发送）
    return apiClient.createEventSource(`/conversations/${conversationId}/stream`)
  },

  // 解析SSE事件
  parseSSEEvent(eventData: string): SSEEvent | null {
    try {
      return JSON.parse(eventData) as SSEEvent
    } catch {
      return null
    }
  },

  // 删除对话
  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/conversations/${conversationId}`)
  },

  // 更新对话标题
  async updateConversationTitle(conversationId: string, title: string): Promise<Conversation> {
    const response = await apiClient.put<ApiResponse<Conversation>>(
      `/conversations/${conversationId}`,
      { title }
    )
    if (!response.data) {
      throw new Error('更新对话标题失败：无效的响应数据')
    }
    return response.data
  },

  // 获取消息详情
  async getMessage(conversationId: string, messageId: string): Promise<Message> {
    const response = await apiClient.get<ApiResponse<Message>>(
      `/conversations/${conversationId}/messages/${messageId}`
    )
    if (!response.data) {
      throw new Error('获取消息详情失败：无效的响应数据')
    }
    return response.data
  },

  // 重新生成消息
  async regenerateMessage(conversationId: string, messageId: string): Promise<Message> {
    const response = await apiClient.post<ApiResponse<Message>>(
      `/conversations/${conversationId}/messages/${messageId}/regenerate`
    )
    if (!response.data) {
      throw new Error('重新生成消息失败：无效的响应数据')
    }
    return response.data
  }
}