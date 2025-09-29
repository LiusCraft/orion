// 认证相关类型
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  department?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarURL?: string;
  role: string;
  department?: string;
  status: string;
  lastLoginAt?: string;
}

// 对话相关类型
export interface Conversation {
  id: string;
  title: string;
  context?: Record<string, unknown>;
  status: string;
  totalMessages: number;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  parentMessageId?: string;
  senderType: "user" | "ai";
  content: string;
  contentType: string;
  metadata?: Record<string, unknown>;
  tokenCount?: number;
  processingTimeMs?: number;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
  metadata?: Record<string, unknown>;
}

// 知识库相关类型
export interface KnowledgeCategory {
  id: string;
  parentId?: string;
  name: string;
  description: string;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  children?: KnowledgeCategory[];
}

export interface KnowledgeDocument {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  contentType: string;
  summary: string;
  tags: string[];
  sourceURL?: string;
  authorId?: string;
  version: number;
  status: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  category?: KnowledgeCategory;
  author?: UserInfo;
}

export interface CreateDocumentRequest {
  categoryId: string;
  title: string;
  content: string;
  contentType?: string;
  summary?: string;
  tags?: string[];
  sourceURL?: string;
}

// 工具相关类型
export interface Tool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  toolType: string;
  config: Record<string, unknown>;
  enabled: boolean;
  lastStatus?: string;
  lastExecutedAt?: string;
  executionCount?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolExecution {
  id: string;
  toolId: string;
  messageId?: string;
  userId: string;
  inputParams: Record<string, unknown>;
  outputResult?: Record<string, unknown>;
  executionTimeMs?: number;
  duration?: number;
  status: string;
  errorMessage?: string;
  error?: string;
  executedAt: string;
  createdAt: string;
}

export interface CreateToolRequest {
  name: string;
  displayName: string;
  description: string;
  toolType: string;
  config: Record<string, unknown>;
}

export interface UpdateToolRequest {
  name?: string;
  displayName?: string;
  description?: string;
  toolType?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface TestToolRequest {
  toolType: string;
  config: Record<string, unknown>;
}

// API响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errorCode?: number;
  timestamp: number;
}

export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPage: number;
  };
}

// SSE事件类型
export interface SSEEvent {
  type:
    | "message_start"
    | "content_delta"
    | "tool_call_start"
    | "tool_call_result"
    | "message_complete"
    | "done";
  data: unknown;
}
