package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"

	"github.com/cdnagent/cdnagent/internal/database/models"
	pkgErrors "github.com/cdnagent/cdnagent/pkg/errors"
)

type KnowledgeHandler struct {
	db *gorm.DB
}

func NewKnowledgeHandler(db *gorm.DB) *KnowledgeHandler {
	return &KnowledgeHandler{db: db}
}

type CreateCategoryRequest struct {
	ParentID    *uuid.UUID `json:"parent_id"`
	Name        string     `json:"name" binding:"required,max=100"`
	Description string     `json:"description"`
	SortOrder   int        `json:"sort_order"`
}

type CreateDocumentRequest struct {
	CategoryID  uuid.UUID      `json:"category_id" binding:"required"`
	Title       string         `json:"title" binding:"required,max=200"`
	Content     string         `json:"content" binding:"required"`
	ContentType string         `json:"content_type"`
	Summary     string         `json:"summary"`
	Tags        []string       `json:"tags"`
	SourceURL   string         `json:"source_url"`
}

type UpdateDocumentRequest struct {
	Title         string   `json:"title" binding:"max=200"`
	Content       string   `json:"content"`
	Summary       string   `json:"summary"`
	Tags          []string `json:"tags"`
	SourceURL     string   `json:"source_url"`
	ChangeSummary string   `json:"change_summary"`
}

type SearchRequest struct {
	Query      string   `json:"query" binding:"required"`
	Categories []string `json:"categories"`
	Tags       []string `json:"tags"`
	Limit      int      `json:"limit"`
}

type CategoryResponse struct {
	ID          uuid.UUID          `json:"id"`
	ParentID    *uuid.UUID         `json:"parent_id"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	SortOrder   int                `json:"sort_order"`
	Status      string             `json:"status"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	Children    []CategoryResponse `json:"children,omitempty"`
}

type DocumentResponse struct {
	ID           uuid.UUID `json:"id"`
	CategoryID   uuid.UUID `json:"category_id"`
	Title        string    `json:"title"`
	Content      string    `json:"content"`
	ContentType  string    `json:"content_type"`
	Summary      string    `json:"summary"`
	Tags         []string  `json:"tags"`
	SourceURL    string    `json:"source_url"`
	AuthorID     *uuid.UUID `json:"author_id"`
	Version      int       `json:"version"`
	Status       string    `json:"status"`
	ViewCount    int       `json:"view_count"`
	LikeCount    int       `json:"like_count"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Category     *CategoryResponse `json:"category,omitempty"`
	Author       *AuthorInfo      `json:"author,omitempty"`
}

type AuthorInfo struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url"`
}

// 知识分类管理
func (h *KnowledgeHandler) CreateCategory(c *gin.Context) {
	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40021,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 如果有父分类，验证父分类是否存在
	if req.ParentID != nil {
		var parentCategory models.KnowledgeCategory
		if err := h.db.Where("id = ? AND status = ?", req.ParentID, "active").First(&parentCategory).Error; err != nil {
			c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
				40022,
				"父分类不存在",
				nil,
			))
			return
		}
	}

	category := models.KnowledgeCategory{
		ID:          uuid.New(),
		ParentID:    req.ParentID,
		Name:        req.Name,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		Status:      "active",
	}

	if err := h.db.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50021,
			"创建分类失败",
			err.Error(),
		))
		return
	}

	response := CategoryResponse{
		ID:          category.ID,
		ParentID:    category.ParentID,
		Name:        category.Name,
		Description: category.Description,
		SortOrder:   category.SortOrder,
		Status:      category.Status,
		CreatedAt:   category.CreatedAt,
		UpdatedAt:   category.UpdatedAt,
	}

	c.JSON(http.StatusCreated, pkgErrors.NewSuccessResponse(response))
}

func (h *KnowledgeHandler) GetCategories(c *gin.Context) {
	var categories []models.KnowledgeCategory
	
	if err := h.db.Where("status = ?", "active").
		Order("sort_order ASC, created_at ASC").
		Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50022,
			"查询分类失败",
			err.Error(),
		))
		return
	}

	// 构建树形结构
	categoryMap := make(map[uuid.UUID]*CategoryResponse)
	var rootCategories []CategoryResponse

	// 第一遍：创建所有分类的响应对象
	for _, cat := range categories {
		categoryMap[cat.ID] = &CategoryResponse{
			ID:          cat.ID,
			ParentID:    cat.ParentID,
			Name:        cat.Name,
			Description: cat.Description,
			SortOrder:   cat.SortOrder,
			Status:      cat.Status,
			CreatedAt:   cat.CreatedAt,
			UpdatedAt:   cat.UpdatedAt,
			Children:    []CategoryResponse{},
		}
	}

	// 第二遍：构建父子关系
	for _, catResp := range categoryMap {
		if catResp.ParentID == nil {
			rootCategories = append(rootCategories, *catResp)
		} else {
			if parent, exists := categoryMap[*catResp.ParentID]; exists {
				parent.Children = append(parent.Children, *catResp)
			}
		}
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(rootCategories))
}

func (h *KnowledgeHandler) UpdateCategory(c *gin.Context) {
	categoryID := c.Param("id")
	
	var category models.KnowledgeCategory
	if err := h.db.Where("id = ? AND status = ?", categoryID, "active").First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40421,
			"分类不存在",
			nil,
		))
		return
	}

	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40023,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 更新分类
	updates := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"sort_order":  req.SortOrder,
		"updated_at":  time.Now(),
	}

	if err := h.db.Model(&category).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50023,
			"更新分类失败",
			err.Error(),
		))
		return
	}

	// 重新查询更新后的数据
	h.db.Where("id = ?", categoryID).First(&category)

	response := CategoryResponse{
		ID:          category.ID,
		ParentID:    category.ParentID,
		Name:        category.Name,
		Description: category.Description,
		SortOrder:   category.SortOrder,
		Status:      category.Status,
		CreatedAt:   category.CreatedAt,
		UpdatedAt:   category.UpdatedAt,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *KnowledgeHandler) DeleteCategory(c *gin.Context) {
	categoryID := c.Param("id")
	
	var category models.KnowledgeCategory
	if err := h.db.Where("id = ? AND status = ?", categoryID, "active").First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40422,
			"分类不存在",
			nil,
		))
		return
	}

	// 检查是否有子分类
	var childCount int64
	h.db.Model(&models.KnowledgeCategory{}).Where("parent_id = ? AND status = ?", categoryID, "active").Count(&childCount)
	if childCount > 0 {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40024,
			"请先删除子分类",
			nil,
		))
		return
	}

	// 检查是否有关联文档
	var docCount int64
	h.db.Model(&models.KnowledgeDocument{}).Where("category_id = ? AND status != ?", categoryID, "archived").Count(&docCount)
	if docCount > 0 {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40025,
			"分类下还有文档，无法删除",
			nil,
		))
		return
	}

	// 软删除
	if err := h.db.Model(&category).Update("status", "inactive").Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50024,
			"删除分类失败",
			err.Error(),
		))
		return
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse("分类删除成功"))
}

// 知识文档管理
func (h *KnowledgeHandler) CreateDocument(c *gin.Context) {
	userID, _ := c.Get("user_id")
	
	var req CreateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40026,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 验证分类是否存在
	var category models.KnowledgeCategory
	if err := h.db.Where("id = ? AND status = ?", req.CategoryID, "active").First(&category).Error; err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40027,
			"分类不存在",
			nil,
		))
		return
	}

	if req.ContentType == "" {
		req.ContentType = "markdown"
	}

	userUUID := userID.(uuid.UUID)
	document := models.KnowledgeDocument{
		ID:          uuid.New(),
		CategoryID:  req.CategoryID,
		Title:       req.Title,
		Content:     req.Content,
		ContentType: req.ContentType,
		Summary:     req.Summary,
		Tags:        pq.StringArray(req.Tags),
		SourceURL:   req.SourceURL,
		AuthorID:    &userUUID,
		Version:     1,
		Status:      "published",
	}

	if err := h.db.Create(&document).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50025,
			"创建文档失败",
			err.Error(),
		))
		return
	}

	// 创建文档版本记录
	version := models.KnowledgeDocumentVersion{
		ID:         uuid.New(),
		DocumentID: document.ID,
		Version:    1,
		Title:      document.Title,
		Content:    document.Content,
		AuthorID:   &userUUID,
	}
	h.db.Create(&version)

	// TODO: 这里应该触发向量化处理
	// go h.processDocumentEmbedding(document.ID)

	categoryResp := CategoryResponse{
		ID:          category.ID,
		Name:        category.Name,
		Description: category.Description,
	}
	response := h.buildDocumentResponse(document, &categoryResp, nil)
	c.JSON(http.StatusCreated, pkgErrors.NewSuccessResponse(response))
}

func (h *KnowledgeHandler) GetDocuments(c *gin.Context) {
	// 分页和过滤参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	categoryID := c.Query("category_id")
	status := c.DefaultQuery("status", "published")
	tag := c.Query("tag")
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	query := h.db.Model(&models.KnowledgeDocument{}).Where("status = ?", status)

	// 添加过滤条件
	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}
	if tag != "" {
		query = query.Where("? = ANY(tags)", tag)
	}
	if search != "" {
		query = query.Where("title ILIKE ? OR summary ILIKE ?", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var documents []models.KnowledgeDocument
	offset := (page - 1) * pageSize
	if err := query.Preload("Category").Preload("Author").
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&documents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50026,
			"查询文档失败",
			err.Error(),
		))
		return
	}

	var responses []DocumentResponse
	for _, doc := range documents {
		var categoryResp *CategoryResponse
		if doc.Category.ID != uuid.Nil {
			categoryResp = &CategoryResponse{
				ID:          doc.Category.ID,
				Name:        doc.Category.Name,
				Description: doc.Category.Description,
			}
		}

		var authorResp *AuthorInfo
		if doc.Author != nil {
			authorResp = &AuthorInfo{
				ID:          doc.Author.ID,
				Username:    doc.Author.Username,
				DisplayName: doc.Author.DisplayName,
				AvatarURL:   doc.Author.AvatarURL,
			}
		}

		responses = append(responses, h.buildDocumentResponse(doc, categoryResp, authorResp))
	}

	result := map[string]interface{}{
		"documents": responses,
		"pagination": map[string]interface{}{
			"page":       page,
			"page_size":  pageSize,
			"total":      total,
			"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
		},
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(result))
}

func (h *KnowledgeHandler) GetDocument(c *gin.Context) {
	documentID := c.Param("id")
	
	var document models.KnowledgeDocument
	if err := h.db.Preload("Category").Preload("Author").
		Where("id = ? AND status != ?", documentID, "archived").
		First(&document).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40423,
			"文档不存在",
			nil,
		))
		return
	}

	// 增加浏览次数
	h.db.Model(&document).Update("view_count", gorm.Expr("view_count + 1"))

	var categoryResp *CategoryResponse
	if document.Category.ID != uuid.Nil {
		categoryResp = &CategoryResponse{
			ID:          document.Category.ID,
			Name:        document.Category.Name,
			Description: document.Category.Description,
		}
	}

	var authorResp *AuthorInfo
	if document.Author != nil {
		authorResp = &AuthorInfo{
			ID:          document.Author.ID,
			Username:    document.Author.Username,
			DisplayName: document.Author.DisplayName,
			AvatarURL:   document.Author.AvatarURL,
		}
	}

	response := h.buildDocumentResponse(document, categoryResp, authorResp)
	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *KnowledgeHandler) UpdateDocument(c *gin.Context) {
	userID, _ := c.Get("user_id")
	documentID := c.Param("id")
	
	var document models.KnowledgeDocument
	if err := h.db.Where("id = ? AND status != ?", documentID, "archived").First(&document).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40424,
			"文档不存在",
			nil,
		))
		return
	}

	var req UpdateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40028,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	// 更新文档
	updates := map[string]interface{}{
		"updated_at": time.Now(),
		"version":    gorm.Expr("version + 1"),
	}

	contentChanged := false
	if req.Title != "" && req.Title != document.Title {
		updates["title"] = req.Title
		contentChanged = true
	}
	if req.Content != "" && req.Content != document.Content {
		updates["content"] = req.Content
		contentChanged = true
	}
	if req.Summary != "" {
		updates["summary"] = req.Summary
	}
	if req.Tags != nil {
		updates["tags"] = pq.StringArray(req.Tags)
	}
	if req.SourceURL != "" {
		updates["source_url"] = req.SourceURL
	}

	if err := h.db.Model(&document).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50027,
			"更新文档失败",
			err.Error(),
		))
		return
	}

	// 如果内容有变化，创建新版本记录
	if contentChanged {
		h.db.Where("id = ?", documentID).First(&document) // 重新获取最新数据
		
		userUUID := userID.(uuid.UUID)
		version := models.KnowledgeDocumentVersion{
			ID:            uuid.New(),
			DocumentID:    document.ID,
			Version:       document.Version,
			Title:         document.Title,
			Content:       document.Content,
			ChangeSummary: req.ChangeSummary,
			AuthorID:      &userUUID,
		}
		h.db.Create(&version)

		// TODO: 重新处理向量化
		// go h.processDocumentEmbedding(document.ID)
	}

	// 重新查询更新后的数据
	h.db.Preload("Category").Preload("Author").Where("id = ?", documentID).First(&document)
	
	var categoryResp *CategoryResponse
	if document.Category.ID != uuid.Nil {
		categoryResp = &CategoryResponse{
			ID:          document.Category.ID,
			Name:        document.Category.Name,
			Description: document.Category.Description,
		}
	}

	var authorResp *AuthorInfo
	if document.Author != nil {
		authorResp = &AuthorInfo{
			ID:          document.Author.ID,
			Username:    document.Author.Username,
			DisplayName: document.Author.DisplayName,
			AvatarURL:   document.Author.AvatarURL,
		}
	}

	response := h.buildDocumentResponse(document, categoryResp, authorResp)
	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(response))
}

func (h *KnowledgeHandler) DeleteDocument(c *gin.Context) {
	documentID := c.Param("id")
	
	var document models.KnowledgeDocument
	if err := h.db.Where("id = ? AND status != ?", documentID, "archived").First(&document).Error; err != nil {
		c.JSON(http.StatusNotFound, pkgErrors.NewErrorResponse(
			40425,
			"文档不存在",
			nil,
		))
		return
	}

	// 软删除：更新状态为archived
	if err := h.db.Model(&document).Update("status", "archived").Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50028,
			"删除文档失败",
			err.Error(),
		))
		return
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse("文档删除成功"))
}

func (h *KnowledgeHandler) SearchDocuments(c *gin.Context) {
	var req SearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, pkgErrors.NewErrorResponse(
			40029,
			"请求参数错误",
			err.Error(),
		))
		return
	}

	if req.Limit <= 0 || req.Limit > 50 {
		req.Limit = 10
	}

	// 构建搜索查询
	query := h.db.Model(&models.KnowledgeDocument{}).Where("status = ?", "published")

	// 文本搜索
	if req.Query != "" {
		searchTerm := "%" + strings.ToLower(req.Query) + "%"
		query = query.Where("LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(summary) LIKE ?", 
			searchTerm, searchTerm, searchTerm)
	}

	// 分类过滤
	if len(req.Categories) > 0 {
		query = query.Where("category_id IN ?", req.Categories)
	}

	// 标签过滤
	if len(req.Tags) > 0 {
		for _, tag := range req.Tags {
			query = query.Where("? = ANY(tags)", tag)
		}
	}

	var documents []models.KnowledgeDocument
	if err := query.Preload("Category").Preload("Author").
		Order("view_count DESC, like_count DESC, created_at DESC").
		Limit(req.Limit).
		Find(&documents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, pkgErrors.NewErrorResponse(
			50029,
			"搜索文档失败",
			err.Error(),
		))
		return
	}

	var responses []DocumentResponse
	for _, doc := range documents {
		var categoryResp *CategoryResponse
		if doc.Category.ID != uuid.Nil {
			categoryResp = &CategoryResponse{
				ID:          doc.Category.ID,
				Name:        doc.Category.Name,
				Description: doc.Category.Description,
			}
		}

		var authorResp *AuthorInfo
		if doc.Author != nil {
			authorResp = &AuthorInfo{
				ID:          doc.Author.ID,
				Username:    doc.Author.Username,
				DisplayName: doc.Author.DisplayName,
				AvatarURL:   doc.Author.AvatarURL,
			}
		}

		responses = append(responses, h.buildDocumentResponse(doc, categoryResp, authorResp))
	}

	result := map[string]interface{}{
		"documents": responses,
		"total":     len(responses),
		"query":     req.Query,
	}

	c.JSON(http.StatusOK, pkgErrors.NewSuccessResponse(result))
}

func (h *KnowledgeHandler) buildDocumentResponse(doc models.KnowledgeDocument, category *CategoryResponse, author *AuthorInfo) DocumentResponse {
	return DocumentResponse{
		ID:          doc.ID,
		CategoryID:  doc.CategoryID,
		Title:       doc.Title,
		Content:     doc.Content,
		ContentType: doc.ContentType,
		Summary:     doc.Summary,
		Tags:        []string(doc.Tags),
		SourceURL:   doc.SourceURL,
		AuthorID:    doc.AuthorID,
		Version:     doc.Version,
		Status:      doc.Status,
		ViewCount:   doc.ViewCount,
		LikeCount:   doc.LikeCount,
		CreatedAt:   doc.CreatedAt,
		UpdatedAt:   doc.UpdatedAt,
		Category:    category,
		Author:      author,
	}
}