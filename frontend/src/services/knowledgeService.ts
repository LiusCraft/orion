import apiClient from './apiClient'
import type { 
  KnowledgeCategory, 
  KnowledgeDocument, 
  CreateDocumentRequest,
  ApiResponse, 
  PaginationResponse 
} from '../types'

export interface KnowledgeSearchParams {
  keyword?: string
  categoryId?: string
  tags?: string[]
  status?: string
  authorId?: string
  page?: number
  pageSize?: number
}

export interface KnowledgeStats {
  totalDocuments: number
  publishedDocuments: number
  draftDocuments: number
  totalViews: number
  totalLikes: number
  categoryCounts: Record<string, number>
  tagCounts: Record<string, number>
}

export const knowledgeService = {
  // 获取知识分类树
  async getCategories(): Promise<KnowledgeCategory[]> {
    const response = await apiClient.get<ApiResponse<KnowledgeCategory[]>>('/knowledge/categories')
    if (!response.data) {
      throw new Error('获取分类列表失败：无效的响应数据')
    }
    return response.data
  },

  // 创建分类
  async createCategory(data: {
    name: string
    description?: string
    parentId?: string
  }): Promise<KnowledgeCategory> {
    const response = await apiClient.post<ApiResponse<KnowledgeCategory>>('/knowledge/categories', data)
    if (!response.data) {
      throw new Error('创建分类失败：无效的响应数据')
    }
    return response.data
  },

  // 更新分类
  async updateCategory(categoryId: string, data: {
    name?: string
    description?: string
    parentId?: string
  }): Promise<KnowledgeCategory> {
    const response = await apiClient.put<ApiResponse<KnowledgeCategory>>(
      `/knowledge/categories/${categoryId}`,
      data
    )
    if (!response.data) {
      throw new Error('更新分类失败：无效的响应数据')
    }
    return response.data
  },

  // 删除分类
  async deleteCategory(categoryId: string): Promise<void> {
    await apiClient.delete(`/knowledge/categories/${categoryId}`)
  },

  // 搜索文档
  async searchDocuments(params: KnowledgeSearchParams = {}): Promise<PaginationResponse<KnowledgeDocument>> {
    const queryParams = new URLSearchParams()
    
    if (params.keyword) queryParams.set('keyword', params.keyword)
    if (params.categoryId) queryParams.set('categoryId', params.categoryId)
    if (params.status) queryParams.set('status', params.status)
    if (params.authorId) queryParams.set('authorId', params.authorId)
    if (params.tags && params.tags.length > 0) {
      params.tags.forEach(tag => queryParams.append('tags', tag))
    }
    
    queryParams.set('page', (params.page || 1).toString())
    queryParams.set('pageSize', (params.pageSize || 20).toString())

    const response = await apiClient.get<ApiResponse<PaginationResponse<KnowledgeDocument>>>(
      `/knowledge/documents?${queryParams.toString()}`
    )
    
    if (!response.data) {
      throw new Error('搜索文档失败：无效的响应数据')
    }
    return response.data
  },

  // 获取文档详情
  async getDocument(documentId: string): Promise<KnowledgeDocument> {
    const response = await apiClient.get<ApiResponse<KnowledgeDocument>>(
      `/knowledge/documents/${documentId}`
    )
    if (!response.data) {
      throw new Error('获取文档详情失败：无效的响应数据')
    }
    return response.data
  },

  // 创建文档
  async createDocument(data: CreateDocumentRequest): Promise<KnowledgeDocument> {
    const response = await apiClient.post<ApiResponse<KnowledgeDocument>>('/knowledge/documents', data)
    if (!response.data) {
      throw new Error('创建文档失败：无效的响应数据')
    }
    return response.data
  },

  // 更新文档
  async updateDocument(documentId: string, data: Partial<CreateDocumentRequest>): Promise<KnowledgeDocument> {
    const response = await apiClient.put<ApiResponse<KnowledgeDocument>>(
      `/knowledge/documents/${documentId}`,
      data
    )
    if (!response.data) {
      throw new Error('更新文档失败：无效的响应数据')
    }
    return response.data
  },

  // 删除文档
  async deleteDocument(documentId: string): Promise<void> {
    await apiClient.delete(`/knowledge/documents/${documentId}`)
  },

  // 发布文档
  async publishDocument(documentId: string): Promise<KnowledgeDocument> {
    const response = await apiClient.post<ApiResponse<KnowledgeDocument>>(
      `/knowledge/documents/${documentId}/publish`
    )
    if (!response.data) {
      throw new Error('发布文档失败：无效的响应数据')
    }
    return response.data
  },

  // 归档文档
  async archiveDocument(documentId: string): Promise<KnowledgeDocument> {
    const response = await apiClient.post<ApiResponse<KnowledgeDocument>>(
      `/knowledge/documents/${documentId}/archive`
    )
    if (!response.data) {
      throw new Error('归档文档失败：无效的响应数据')
    }
    return response.data
  },

  // 点赞文档
  async likeDocument(documentId: string): Promise<void> {
    await apiClient.post(`/knowledge/documents/${documentId}/like`)
  },

  // 取消点赞
  async unlikeDocument(documentId: string): Promise<void> {
    await apiClient.delete(`/knowledge/documents/${documentId}/like`)
  },

  // 增加查看次数
  async incrementViewCount(documentId: string): Promise<void> {
    await apiClient.post(`/knowledge/documents/${documentId}/view`)
  },

  // 获取统计信息
  async getStatistics(): Promise<KnowledgeStats> {
    const response = await apiClient.get<ApiResponse<KnowledgeStats>>('/knowledge/statistics')
    if (!response.data) {
      throw new Error('获取统计信息失败：无效的响应数据')
    }
    return response.data
  },

  // 获取推荐文档
  async getRecommendedDocuments(limit = 10): Promise<KnowledgeDocument[]> {
    const response = await apiClient.get<ApiResponse<KnowledgeDocument[]>>(
      `/knowledge/documents/recommended?limit=${limit}`
    )
    if (!response.data) {
      throw new Error('获取推荐文档失败：无效的响应数据')
    }
    return response.data
  },

  // 获取最近更新的文档
  async getRecentDocuments(limit = 10): Promise<KnowledgeDocument[]> {
    const response = await apiClient.get<ApiResponse<KnowledgeDocument[]>>(
      `/knowledge/documents/recent?limit=${limit}`
    )
    if (!response.data) {
      throw new Error('获取最近文档失败：无效的响应数据')
    }
    return response.data
  },

  // 获取热门标签
  async getPopularTags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
    const response = await apiClient.get<ApiResponse<Array<{ tag: string; count: number }>>>(
      `/knowledge/tags/popular?limit=${limit}`
    )
    if (!response.data) {
      throw new Error('获取热门标签失败：无效的响应数据')
    }
    return response.data
  },

  // 批量导入文档
  async importDocuments(file: File, categoryId: string): Promise<{ 
    success: number; 
    failed: number; 
    errors: string[] 
  }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('categoryId', categoryId)

    const response = await apiClient.post<ApiResponse<{ 
      success: number; 
      failed: number; 
      errors: string[] 
    }>>('/knowledge/documents/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    if (!response.data) {
      throw new Error('批量导入失败：无效的响应数据')
    }
    return response.data
  },

  // 导出文档
  async exportDocuments(documentIds: string[]): Promise<Blob> {
    const response = await apiClient.post('/knowledge/documents/export', {
      documentIds
    }, {
      responseType: 'blob'
    })
    return response as unknown as Blob
  }
}