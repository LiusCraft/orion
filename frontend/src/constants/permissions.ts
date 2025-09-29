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

// 权限接口
export interface Permission {
  resource: string
  action: string
}