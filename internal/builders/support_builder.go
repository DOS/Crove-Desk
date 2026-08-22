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

func BuildSupportQuestionCategory(item *models.SupportQuestionCategory) *response.SupportQuestionCategoryResponse {
	if item == nil {
		return nil
	}
	return &response.SupportQuestionCategoryResponse{
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

func BuildSupportQuestionCategories(list []models.SupportQuestionCategory) []response.SupportQuestionCategoryResponse {
	ret := make([]response.SupportQuestionCategoryResponse, 0, len(list))
	for _, item := range list {
		if resp := BuildSupportQuestionCategory(&item); resp != nil {
			ret = append(ret, *resp)
		}
	}
	return ret
}

func BuildSupportQuestion(item *models.SupportQuestion, categoryName string, user *models.User) *response.SupportQuestionResponse {
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
	return &response.SupportQuestionResponse{
		ID:                 item.ID,
		CategoryID:         item.CategoryID,
		CategoryName:       categoryName,
		UserID:             item.UserID,
		UserName:           userName,
		UserType:           userType,
		Title:              item.Title,
		ContentType:        item.ContentType,
		Content:            item.Content,
		Tags:               parseSupportTags(item.TagsJSON),
		Status:             item.Status,
		BestAnswerID:       item.BestAnswerID,
		AnswerCount:        item.AnswerCount,
		VoteCount:          item.VoteCount,
		ViewCount:          item.ViewCount,
		LastAnsweredAt:     formatSupportTime(item.LastAnsweredAt),
		LastAnswerUserType: item.LastAnswerUserType,
		LastAnswerUserID:   item.LastAnswerUserID,
		CreatedAt:          formatSupportTime(&item.CreatedAt),
		UpdatedAt:          formatSupportTime(&item.UpdatedAt),
	}
}

func BuildSupportAnswer(item *models.SupportAnswer, authorName string) *response.SupportAnswerResponse {
	if item == nil {
		return nil
	}
	return &response.SupportAnswerResponse{
		ID:           item.ID,
		QuestionID:   item.QuestionID,
		AuthorType:   item.AuthorType,
		AuthorID:     item.AuthorID,
		AuthorName:   authorName,
		ContentType:  item.ContentType,
		Content:      item.Content,
		Status:       item.Status,
		VoteCount:    item.VoteCount,
		IsBestAnswer: item.IsBestAnswer,
		CreatedAt:    formatSupportTime(&item.CreatedAt),
		UpdatedAt:    formatSupportTime(&item.UpdatedAt),
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
