package request

import "agent-desk/internal/pkg/enums"

type SupportCustomerRegisterRequest struct {
	Name     string `json:"name"`
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

type UpdateSupportHelpPageSettingsRequest struct {
	ID       int64  `json:"id"`
	ParentID int64  `json:"parentId"`
	Slug     string `json:"slug"`
	Summary  string `json:"summary"`
}

type SortSupportHelpPagesRequest struct {
	ParentID int64   `json:"parentId"`
	IDs      []int64 `json:"ids"`
}

type ChangeSupportHelpPageStatusRequest struct {
	ID     int64                       `json:"id"`
	Status enums.SupportHelpPageStatus `json:"status"`
}

type SaveSupportCategoryRequest struct {
	ID          int64        `json:"id"`
	Name        string       `json:"name"`
	Slug        string       `json:"slug"`
	Description string       `json:"description"`
	Status      enums.Status `json:"status"`
	Remark      string       `json:"remark"`
}

type CreateSupportPostRequest struct {
	CategoryID  int64    `json:"categoryId"`
	Title       string   `json:"title"`
	ContentType string   `json:"contentType"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
}

type UpdateSupportPostRequest struct {
	ID          int64    `json:"id"`
	CategoryID  int64    `json:"categoryId"`
	Title       string   `json:"title"`
	ContentType string   `json:"contentType"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
}

type ModerateSupportPostRequest struct {
	ID     int64                   `json:"id"`
	Status enums.SupportPostStatus `json:"status"`
}

type CreateSupportCommentRequest struct {
	PostID      int64  `json:"postId"`
	ParentID    int64  `json:"parentId"`
	ContentType string `json:"contentType"`
	Content     string `json:"content"`
}

type UpdateSupportCommentRequest struct {
	ID          int64  `json:"id"`
	ContentType string `json:"contentType"`
	Content     string `json:"content"`
}

type ModerateSupportCommentRequest struct {
	ID     int64                      `json:"id"`
	Status enums.SupportCommentStatus `json:"status"`
}

type SupportIDRequest struct {
	ID int64 `json:"id"`
}

type SupportReactionRequest struct {
	TargetType   enums.SupportReactionTarget `json:"targetType"`
	TargetID     int64                       `json:"targetId"`
	ReactionType enums.SupportReactionType   `json:"reactionType"`
}

type ReportSupportCommentRequest struct {
	ID     int64  `json:"id"`
	Reason string `json:"reason"`
}

type SupportAcceptCommentRequest struct {
	PostID    int64 `json:"postId"`
	CommentID int64 `json:"commentId"`
}

type SupportHelpPageFeedbackRequest struct {
	ID      int64 `json:"id"`
	Helpful bool  `json:"helpful"`
}

type DeleteByIDRequest struct {
	ID int64 `json:"id"`
}
