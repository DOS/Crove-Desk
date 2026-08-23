package builders

import (
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/enums"
	"encoding/json"
	"time"
)

func BuildSupportHelpPage(item *models.SupportHelpPage, includeContent bool) *response.SupportHelpPageResponse {
	if item == nil {
		return nil
	}
	content := item.Content
	if !includeContent {
		content = ""
	}
	return &response.SupportHelpPageResponse{
		ID:                        item.ID,
		ParentID:                  item.ParentID,
		Title:                     item.Title,
		Slug:                      item.Slug,
		Summary:                   item.Summary,
		ContentType:               item.ContentType,
		Content:                   content,
		CoverURL:                  item.CoverURL,
		Tags:                      parseSupportTags(item.TagsJSON),
		Status:                    item.Status,
		SortNo:                    item.SortNo,
		ViewCount:                 item.ViewCount,
		HelpfulCount:              item.HelpfulCount,
		UnhelpfulCount:            item.UnhelpfulCount,
		PublishedAt:               formatSupportTime(item.PublishedAt),
		SyncedKnowledgeDocumentID: item.SyncedKnowledgeDocumentID,
		Remark:                    item.Remark,
		CreatedAt:                 formatSupportTime(&item.CreatedAt),
		UpdatedAt:                 formatSupportTime(&item.UpdatedAt),
	}
}

func BuildSupportHelpPageNavigationTree(list []models.SupportHelpPage) []*response.SupportHelpPageNavigationResponse {
	nodes := make(map[int64]*response.SupportHelpPageNavigationResponse, len(list))
	for i := range list {
		item := &list[i]
		nodes[item.ID] = &response.SupportHelpPageNavigationResponse{
			ID: item.ID, ParentID: item.ParentID, Title: item.Title, Slug: item.Slug, SortNo: item.SortNo,
			Children: make([]*response.SupportHelpPageNavigationResponse, 0),
		}
	}
	roots := make([]*response.SupportHelpPageNavigationResponse, 0)
	for i := range list {
		item := &list[i]
		node := nodes[item.ID]
		if item.ParentID == 0 || nodes[item.ParentID] == nil {
			roots = append(roots, node)
			continue
		}
		nodes[item.ParentID].Children = append(nodes[item.ParentID].Children, node)
	}
	return roots
}

func BuildSupportCategory(item *models.SupportCategory) *response.SupportCategoryResponse {
	if item == nil {
		return nil
	}
	return &response.SupportCategoryResponse{
		ID:          item.ID,
		Name:        item.Name,
		Slug:        item.Slug,
		Description: item.Description,
		SortNo:      item.SortNo,
		Status:      item.Status,
		Remark:      item.Remark,
		CreatedAt:   formatSupportTime(&item.CreatedAt),
		UpdatedAt:   formatSupportTime(&item.UpdatedAt),
	}
}

func BuildSupportPostCategories(list []models.SupportCategory) []response.SupportCategoryResponse {
	ret := make([]response.SupportCategoryResponse, 0, len(list))
	for _, item := range list {
		if resp := BuildSupportCategory(&item); resp != nil {
			ret = append(ret, *resp)
		}
	}
	return ret
}

func BuildSupportPost(item *models.SupportPost, categoryName string, user *models.User) *response.SupportPostResponse {
	if item == nil {
		return nil
	}
	userName := ""
	userType := enums.UserTypeUser
	if user != nil {
		userName = user.Nickname
		if userName == "" {
			userName = user.Username
		}
		userType = user.UserType
	}
	return &response.SupportPostResponse{
		ID:                  item.ID,
		CategoryID:          item.CategoryID,
		CategoryName:        categoryName,
		UserID:              item.UserID,
		UserName:            userName,
		UserType:            userType,
		Title:               item.Title,
		ContentType:         item.ContentType,
		Content:             item.Content,
		Tags:                parseSupportTags(item.TagsJSON),
		Status:              item.Status,
		AcceptedCommentID:   item.AcceptedCommentID,
		CommentCount:        item.CommentCount,
		ReactionCount:       item.ReactionCount,
		ViewCount:           item.ViewCount,
		LastCommentedAt:     formatSupportTime(item.LastCommentedAt),
		LastCommentUserType: item.LastCommentUserType,
		LastCommentUserID:   item.LastCommentUserID,
		CreatedAt:           formatSupportTime(&item.CreatedAt),
		UpdatedAt:           formatSupportTime(&item.UpdatedAt),
	}
}

func BuildSupportComment(item *models.SupportComment, authorName string) *response.SupportCommentResponse {
	if item == nil {
		return nil
	}
	contentType := item.ContentType
	content := item.Content
	if item.Status == enums.SupportCommentStatusDeleted {
		contentType = "markdown"
		content = ""
	}
	return &response.SupportCommentResponse{
		ID:            item.ID,
		PostID:        item.PostID,
		ParentID:      item.ParentID,
		AuthorType:    item.AuthorType,
		AuthorID:      item.AuthorID,
		AuthorName:    authorName,
		ContentType:   contentType,
		Content:       content,
		Status:        item.Status,
		ReactionCount: item.ReactionCount,
		ReplyCount:    item.ReplyCount,
		ReportCount:   item.ReportCount,
		IsAccepted:    item.IsAccepted,
		Replies:       []response.SupportCommentResponse{},
		CreatedAt:     formatSupportTime(&item.CreatedAt),
		UpdatedAt:     formatSupportTime(&item.UpdatedAt),
	}
}

func parseSupportTags(raw string) []string {
	var ret []string
	if raw == "" {
		return []string{}
	}
	if err := json.Unmarshal([]byte(raw), &ret); err != nil {
		return []string{}
	}
	return ret
}

func formatSupportTime(t *time.Time) string {
	if t == nil || t.IsZero() {
		return ""
	}
	return t.Format(time.DateTime)
}
