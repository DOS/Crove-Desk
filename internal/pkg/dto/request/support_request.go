package request

import "agent-desk/internal/pkg/enums"

type SupportCustomerRegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SupportCustomerLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type SaveSupportHelpPageRequest struct {
	ID          int64                       `json:"id"`
	ParentID    int64                       `json:"parentId"`
	Title       string                      `json:"title"`
	Slug        string                      `json:"slug"`
	Summary     string                      `json:"summary"`
	ContentType string                      `json:"contentType"`
	Content     string                      `json:"content"`
	CoverURL    string                      `json:"coverUrl"`
	Tags        []string                    `json:"tags"`
	Status      enums.SupportHelpPageStatus `json:"status"`
	SortNo      int                         `json:"sortNo"`
	Remark      string                      `json:"remark"`
}

type SaveSupportQuestionCategoryRequest struct {
	ID          int64        `json:"id"`
	Name        string       `json:"name"`
	Slug        string       `json:"slug"`
	Description string       `json:"description"`
	SortNo      int          `json:"sortNo"`
	Status      enums.Status `json:"status"`
	Remark      string       `json:"remark"`
}

type CreateSupportQuestionRequest struct {
	CategoryID int64    `json:"categoryId"`
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Tags       []string `json:"tags"`
}

type UpdateSupportQuestionRequest struct {
	ID         int64    `json:"id"`
	CategoryID int64    `json:"categoryId"`
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Tags       []string `json:"tags"`
}

type ModerateSupportQuestionRequest struct {
	ID     int64                       `json:"id"`
	Status enums.SupportQuestionStatus `json:"status"`
}

type CreateSupportAnswerRequest struct {
	QuestionID int64  `json:"questionId"`
	Content    string `json:"content"`
}

type UpdateSupportAnswerRequest struct {
	ID      int64  `json:"id"`
	Content string `json:"content"`
}

type ModerateSupportAnswerRequest struct {
	ID     int64                     `json:"id"`
	Status enums.SupportAnswerStatus `json:"status"`
}

type SupportVoteRequest struct {
	ID int64 `json:"id"`
}

type SupportAcceptAnswerRequest struct {
	QuestionID int64 `json:"questionId"`
	AnswerID   int64 `json:"answerId"`
}

type SupportHelpPageFeedbackRequest struct {
	ID      int64 `json:"id"`
	Helpful bool  `json:"helpful"`
}

type DeleteByIDRequest struct {
	ID int64 `json:"id"`
}
