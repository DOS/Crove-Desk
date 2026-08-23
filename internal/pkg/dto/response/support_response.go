package response

import "agent-desk/internal/pkg/enums"

type SupportUserResponse struct {
	ID       int64          `json:"id"`
	Name     string         `json:"name"`
	Email    string         `json:"email"`
	UserType enums.UserType `json:"userType"`
}

type SupportHelpPageResponse struct {
	ID                        int64                       `json:"id"`
	ParentID                  int64                       `json:"parentId"`
	Title                     string                      `json:"title"`
	Slug                      string                      `json:"slug"`
	Summary                   string                      `json:"summary"`
	ContentType               string                      `json:"contentType"`
	Content                   string                      `json:"content"`
	CoverURL                  string                      `json:"coverUrl"`
	Tags                      []string                    `json:"tags"`
	Status                    enums.SupportHelpPageStatus `json:"status"`
	SortNo                    int                         `json:"sortNo"`
	ViewCount                 int64                       `json:"viewCount"`
	HelpfulCount              int64                       `json:"helpfulCount"`
	UnhelpfulCount            int64                       `json:"unhelpfulCount"`
	PublishedAt               string                      `json:"publishedAt"`
	SyncedKnowledgeDocumentID int64                       `json:"syncedKnowledgeDocumentId"`
	Remark                    string                      `json:"remark"`
	CreatedAt                 string                      `json:"createdAt"`
	UpdatedAt                 string                      `json:"updatedAt"`
}

// SupportHelpPageNavigationResponse is the lightweight public document tree.
// Content remains available only from the help-page detail endpoint.
type SupportHelpPageNavigationResponse struct {
	ID       int64                                `json:"id"`
	ParentID int64                                `json:"parentId"`
	Title    string                               `json:"title"`
	Slug     string                               `json:"slug"`
	SortNo   int                                  `json:"sortNo"`
	Children []*SupportHelpPageNavigationResponse `json:"children"`
}

type SupportCategoryResponse struct {
	ID          int64        `json:"id"`
	Name        string       `json:"name"`
	Slug        string       `json:"slug"`
	Description string       `json:"description"`
	SortNo      int          `json:"sortNo"`
	Status      enums.Status `json:"status"`
	Remark      string       `json:"remark"`
	CreatedAt   string       `json:"createdAt"`
	UpdatedAt   string       `json:"updatedAt"`
}

type SupportPostResponse struct {
	ID                  int64                          `json:"id"`
	CategoryID          int64                          `json:"categoryId"`
	CategoryName        string                         `json:"categoryName"`
	UserID              int64                          `json:"userId"`
	UserName            string                         `json:"userName"`
	UserType            enums.UserType                 `json:"userType"`
	Title               string                         `json:"title"`
	ContentType         string                         `json:"contentType"`
	Content             string                         `json:"content"`
	Tags                []string                       `json:"tags"`
	Status              enums.SupportPostStatus        `json:"status"`
	AcceptedCommentID   int64                          `json:"acceptedCommentId"`
	CommentCount        int64                          `json:"commentCount"`
	ReactionCount       int64                          `json:"reactionCount"`
	ViewCount           int64                          `json:"viewCount"`
	LastCommentedAt     string                         `json:"lastCommentedAt"`
	LastCommentUserType enums.SupportCommentAuthorType `json:"lastCommentUserType"`
	LastCommentUserID   int64                          `json:"lastCommentUserId"`
	CreatedAt           string                         `json:"createdAt"`
	UpdatedAt           string                         `json:"updatedAt"`
}

type SupportCommentResponse struct {
	ID            int64                          `json:"id"`
	PostID        int64                          `json:"postId"`
	ParentID      int64                          `json:"parentId"`
	AuthorType    enums.SupportCommentAuthorType `json:"authorType"`
	AuthorID      int64                          `json:"authorId"`
	AuthorName    string                         `json:"authorName"`
	ContentType   string                         `json:"contentType"`
	Content       string                         `json:"content"`
	Status        enums.SupportCommentStatus     `json:"status"`
	ReactionCount int64                          `json:"reactionCount"`
	ReplyCount    int64                          `json:"replyCount"`
	ReportCount   int64                          `json:"reportCount"`
	IsAccepted    bool                           `json:"isAccepted"`
	Replies       []SupportCommentResponse       `json:"replies"`
	CreatedAt     string                         `json:"createdAt"`
	UpdatedAt     string                         `json:"updatedAt"`
}

type SupportPostDetailResponse struct {
	Post     SupportPostResponse      `json:"post"`
	Comments []SupportCommentResponse `json:"comments"`
}
