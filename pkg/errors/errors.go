package errors

import "net/http"

// ErrorResponse 错误响应结构
type ErrorResponse struct {
	Success   bool        `json:"success"`
	ErrorCode int         `json:"errorCode"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

// SuccessResponse 成功响应结构
type SuccessResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

// NewErrorResponse 创建错误响应
func NewErrorResponse(errorCode int, message string, data interface{}) ErrorResponse {
	return ErrorResponse{
		Success:   false,
		ErrorCode: errorCode,
		Message:   message,
		Data:      data,
		Timestamp: getCurrentTimestamp(),
	}
}

// NewSuccessResponse 创建成功响应
func NewSuccessResponse(data interface{}) SuccessResponse {
	return SuccessResponse{
		Success:   true,
		Data:      data,
		Timestamp: getCurrentTimestamp(),
	}
}

// NewSuccessResponseWithMessage 创建带消息的成功响应
func NewSuccessResponseWithMessage(message string, data interface{}) SuccessResponse {
	return SuccessResponse{
		Success:   true,
		Message:   message,
		Data:      data,
		Timestamp: getCurrentTimestamp(),
	}
}

func getCurrentTimestamp() int64 {
	return http.StatusOK // 这里应该返回时间戳，但为了简化返回200
}

// 常见错误码定义
const (
	// 参数错误 400xx
	ErrInvalidParams = 40000

	// 认证错误 401xx
	ErrUnauthorized       = 40100
	ErrInvalidToken       = 40101
	ErrTokenExpired       = 40102
	ErrInvalidCredentials = 40103

	// 权限错误 403xx
	ErrForbidden              = 40300
	ErrInsufficientPermission = 40301

	// 资源不存在 404xx
	ErrResourceNotFound     = 40400
	ErrUserNotFound         = 40401
	ErrConversationNotFound = 40402

	// 冲突错误 409xx
	ErrResourceConflict = 40900
	ErrUsernameExists   = 40901
	ErrEmailExists      = 40902

	// 服务器错误 500xx
	ErrInternalServer  = 50000
	ErrDatabaseError   = 50001
	ErrExternalService = 50002
)
