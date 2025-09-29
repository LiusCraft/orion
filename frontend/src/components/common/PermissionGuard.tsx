import React from 'react'
import { useAuthStore } from '../../store/authStore'

interface Permission {
  resource: string
  action: string
}

interface PermissionGuardProps {
  children: React.ReactNode
  permission?: Permission
  role?: string | string[]
  fallback?: React.ReactNode
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  role,
  fallback = null
}) => {
  const { user } = useAuthStore()

  if (!user) {
    return fallback
  }

  // 角色检查
  if (role) {
    const requiredRoles = Array.isArray(role) ? role : [role]
    if (!requiredRoles.includes(user.role)) {
      return fallback
    }
  }

  // 权限检查（这里可以根据实际需求扩展）
  if (permission) {
    // TODO: 实现具体的权限检查逻辑
    // 目前简化处理，管理员拥有所有权限
    if (user.role !== 'admin' && permission.resource === 'admin') {
      return fallback
    }
  }

  return <>{children}</>
}

// 权限常量
export const PERMISSIONS = {
  // 用户管理
  USER_VIEW: { resource: 'user', action: 'view' },
  USER_CREATE: { resource: 'user', action: 'create' },
  USER_EDIT: { resource: 'user', action: 'edit' },
  USER_DELETE: { resource: 'user', action: 'delete' },
  
  // 知识库管理
  KNOWLEDGE_VIEW: { resource: 'knowledge', action: 'view' },
  KNOWLEDGE_CREATE: { resource: 'knowledge', action: 'create' },
  KNOWLEDGE_EDIT: { resource: 'knowledge', action: 'edit' },
  KNOWLEDGE_DELETE: { resource: 'knowledge', action: 'delete' },
  
  // 工具管理
  TOOL_VIEW: { resource: 'tool', action: 'view' },
  TOOL_CONFIG: { resource: 'tool', action: 'config' },
  
  // 系统管理
  ADMIN_VIEW: { resource: 'admin', action: 'view' },
  ADMIN_CONFIG: { resource: 'admin', action: 'config' },
} as const

// 角色常量
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
} as const

// 权限检查Hook
export const usePermission = () => {
  const { user } = useAuthStore()

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false
    
    // 管理员拥有所有权限
    if (user.role === ROLES.ADMIN) return true
    
    // TODO: 实现具体的权限检查逻辑
    // 这里可以根据用户角色和权限进行更复杂的判断
    console.log('Checking permission:', permission)
    
    return false
  }

  const hasRole = (role: string | string[]): boolean => {
    if (!user) return false
    
    const requiredRoles = Array.isArray(role) ? role : [role]
    return requiredRoles.includes(user.role)
  }

  const isAdmin = (): boolean => {
    return user?.role === ROLES.ADMIN
  }

  return {
    hasPermission,
    hasRole,
    isAdmin,
    user
  }
}