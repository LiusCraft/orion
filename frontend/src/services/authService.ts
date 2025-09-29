import apiClient from './apiClient'
import type { LoginRequest, RegisterRequest, LoginResponse, ApiResponse, UserInfo } from '../types'

export const authService = {
  // 登录
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials)
    if (!response.data) {
      throw new Error('登录失败：无效的响应数据')
    }
    return response.data
  },

  // 注册
  async register(userData: RegisterRequest): Promise<LoginResponse> {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/register', userData)
    if (!response.data) {
      throw new Error('注册失败：无效的响应数据')
    }
    return response.data
  },

  // 刷新token
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    )
    if (!response.data) {
      throw new Error('刷新token失败：无效的响应数据')
    }
    return response.data
  },

  // 登出
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },

  // 获取用户信息
  async getProfile(): Promise<UserInfo> {
    const response = await apiClient.get<ApiResponse<UserInfo>>('/auth/profile')
    if (!response.data) {
      throw new Error('获取用户信息失败：无效的响应数据')
    }
    return response.data
  },
}