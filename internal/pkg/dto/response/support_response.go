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

type SupportQuestionCategoryResponse struct {
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

type SupportQuestionResponse struct {
	ID                 int64                         `json:"id"`
	CategoryID         int64                         `json:"categoryId"`
	CategoryName       string                        `json:"categoryName"`
	UserID             int64                         `json:"userId"`
	UserName           string                        `json:"userName"`
	UserType           enums.UserType                `json:"userType"`
	Title              string                        `json:"title"`
	Content            string                        `json:"content"`
	Tags               []string                      `json:"tags"`
	Status             enums.SupportQuestionStatus   `json:"status"`
	BestAnswerID       int64                         `json:"bestAnswerId"`
	AnswerCount        int64                         `json:"answerCount"`
	VoteCount          int64                         `json:"voteCount"`
	ViewCount          int64                         `json:"viewCount"`
	LastAnsweredAt     string                        `json:"lastAnsweredAt"`
	LastAnswerUserType enums.SupportAnswerAuthorType `json:"lastAnswerUserType"`
	LastAnswerUserID   int64                         `json:"lastAnswerUserId"`
	CreatedAt          string                        `json:"createdAt"`
	UpdatedAt          string                        `json:"updatedAt"`
}

type SupportAnswerResponse struct {
	ID           int64                         `json:"id"`
	QuestionID   int64                         `json:"questionId"`
	AuthorType   enums.SupportAnswerAuthorType `json:"authorType"`
	AuthorID     int64                         `json:"authorId"`
	AuthorName   string                        `json:"authorName"`
	Content      string                        `json:"content"`
	Status       enums.SupportAnswerStatus     `json:"status"`
	VoteCount    int64                         `json:"voteCount"`
	IsBestAnswer bool                          `json:"isBestAnswer"`
	CreatedAt    string                        `json:"createdAt"`
	UpdatedAt    string                        `json:"updatedAt"`
}

type SupportQuestionDetailResponse struct {
	Question SupportQuestionResponse `json:"question"`
	Answers  []SupportAnswerResponse `json:"answers"`
}
