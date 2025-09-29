import apiClient from './apiClient'
import type { 
  Tool, 
  ToolExecution,
  ApiResponse, 
  PaginationResponse 
} from '../types'

export interface ToolCreateRequest {
  name: string
  displayName: string
  description: string
  toolType: string
  config: Record<string, unknown>
  enabled?: boolean
}

export interface ToolUpdateRequest {
  displayName?: string
  description?: string
  config?: Record<string, unknown>
  enabled?: boolean
}

export interface ToolExecutionRequest {
  toolId: string
  inputParams: Record<string, unknown>
  messageId?: string
}

export interface ToolTestRequest {
  toolType: string
  config: Record<string, unknown>
}

export interface ToolStats {
  totalTools: number
  activeTools: number
  totalExecutions: number
  successRate: number
  averageExecutionTime: number
  toolUsageStats: Array<{
    toolId: string
    toolName: string
    executionCount: number
    successCount: number
    averageTime: number
  }>
}

export const toolService = {
  // 获取工具列表
  async getTools(page = 1, pageSize = 50): Promise<PaginationResponse<Tool>> {
    const response = await apiClient.get<ApiResponse<PaginationResponse<Tool>>>(
      `/tools?page=${page}&pageSize=${pageSize}`
    )
    if (!response.data) {
      throw new Error('获取工具列表失败：无效的响应数据')
    }
    return response.data
  },

  // 获取工具详情
  async getTool(toolId: string): Promise<Tool> {
    const response = await apiClient.get<ApiResponse<Tool>>(`/tools/${toolId}`)
    if (!response.data) {
      throw new Error('获取工具详情失败：无效的响应数据')
    }
    return response.data
  },

  // 创建工具
  async createTool(data: ToolCreateRequest): Promise<Tool> {
    const response = await apiClient.post<ApiResponse<Tool>>('/tools', data)
    if (!response.data) {
      throw new Error('创建工具失败：无效的响应数据')
    }
    return response.data
  },

  // 更新工具
  async updateTool(toolId: string, data: ToolUpdateRequest): Promise<Tool> {
    const response = await apiClient.put<ApiResponse<Tool>>(`/tools/${toolId}`, data)
    if (!response.data) {
      throw new Error('更新工具失败：无效的响应数据')
    }
    return response.data
  },

  // 删除工具
  async deleteTool(toolId: string): Promise<void> {
    await apiClient.delete(`/tools/${toolId}`)
  },

  // 启用/禁用工具
  async toggleTool(toolId: string, enabled: boolean): Promise<Tool> {
    const response = await apiClient.put<ApiResponse<Tool>>(`/tools/${toolId}/toggle`, {
      enabled
    })
    if (!response.data) {
      throw new Error('切换工具状态失败：无效的响应数据')
    }
    return response.data
  },

  // 测试工具连接
  async testTool(data: ToolTestRequest): Promise<{
    success: boolean
    message: string
    responseTime?: number
    details?: Record<string, unknown>
  }> {
    const response = await apiClient.post<ApiResponse<{
      success: boolean
      message: string
      responseTime?: number
      details?: Record<string, unknown>
    }>>('/tools/test', data)
    
    if (!response.data) {
      throw new Error('测试工具失败：无效的响应数据')
    }
    return response.data
  },

  // 执行工具
  async executeTool(data: ToolExecutionRequest): Promise<ToolExecution> {
    const response = await apiClient.post<ApiResponse<ToolExecution>>('/tools/execute', data)
    if (!response.data) {
      throw new Error('执行工具失败：无效的响应数据')
    }
    return response.data
  },

  // 获取工具执行历史
  async getToolExecutions(
    toolId?: string, 
    page = 1, 
    pageSize = 20
  ): Promise<PaginationResponse<ToolExecution>> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    })
    
    if (toolId) {
      params.set('toolId', toolId)
    }

    const response = await apiClient.get<ApiResponse<PaginationResponse<ToolExecution>>>(
      `/tools/executions?${params.toString()}`
    )
    
    if (!response.data) {
      throw new Error('获取工具执行历史失败：无效的响应数据')
    }
    return response.data
  },

  // 获取工具执行详情
  async getToolExecution(executionId: string): Promise<ToolExecution> {
    const response = await apiClient.get<ApiResponse<ToolExecution>>(
      `/tools/executions/${executionId}`
    )
    if (!response.data) {
      throw new Error('获取工具执行详情失败：无效的响应数据')
    }
    return response.data
  },

  // 获取工具统计信息
  async getToolStats(): Promise<ToolStats> {
    const response = await apiClient.get<ApiResponse<ToolStats>>('/tools/statistics')
    if (!response.data) {
      throw new Error('获取工具统计失败：无效的响应数据')
    }
    return response.data
  },

  // 获取支持的工具类型
  async getToolTypes(): Promise<Array<{
    type: string
    name: string
    description: string
    configSchema: Record<string, unknown>
    examples?: Record<string, unknown>
  }>> {
    const response = await apiClient.get<ApiResponse<Array<{
      type: string
      name: string
      description: string
      configSchema: Record<string, unknown>
      examples?: Record<string, unknown>
    }>>>('/tools/types')
    
    if (!response.data) {
      throw new Error('获取工具类型失败：无效的响应数据')
    }
    return response.data
  },

  // 获取工具配置模板
  async getToolTemplate(toolType: string): Promise<{
    type: string
    name: string
    description: string
    configSchema: Record<string, unknown>
    defaultConfig: Record<string, unknown>
    examples: Record<string, unknown>
  }> {
    const response = await apiClient.get<ApiResponse<{
      type: string
      name: string
      description: string
      configSchema: Record<string, unknown>
      defaultConfig: Record<string, unknown>
      examples: Record<string, unknown>
    }>>(`/tools/types/${toolType}/template`)
    
    if (!response.data) {
      throw new Error('获取工具模板失败：无效的响应数据')
    }
    return response.data
  },

  // 验证工具配置
  async validateToolConfig(toolType: string, config: Record<string, unknown>): Promise<{
    valid: boolean
    errors?: string[]
    warnings?: string[]
  }> {
    const response = await apiClient.post<ApiResponse<{
      valid: boolean
      errors?: string[]
      warnings?: string[]
    }>>(`/tools/types/${toolType}/validate`, { config })
    
    if (!response.data) {
      throw new Error('验证工具配置失败：无效的响应数据')
    }
    return response.data
  },

  // 批量导入工具配置
  async importTools(file: File): Promise<{
    success: number
    failed: number
    errors: string[]
  }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<ApiResponse<{
      success: number
      failed: number
      errors: string[]
    }>>('/tools/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    if (!response.data) {
      throw new Error('批量导入工具失败：无效的响应数据')
    }
    return response.data
  },

  // 导出工具配置
  async exportTools(toolIds: string[]): Promise<Blob> {
    const response = await apiClient.post('/tools/export', {
      toolIds
    }, {
      responseType: 'blob'
    })
    return response as unknown as Blob
  },

  // 同步工具状态
  async syncToolStatus(toolId: string): Promise<Tool> {
    const response = await apiClient.post<ApiResponse<Tool>>(`/tools/${toolId}/sync`)
    if (!response.data) {
      throw new Error('同步工具状态失败：无效的响应数据')
    }
    return response.data
  }
}