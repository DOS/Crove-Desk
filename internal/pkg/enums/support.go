package enums

type SupportArticleStatus string

const (
	SupportArticleStatusDraft     SupportArticleStatus = "draft"
	SupportArticleStatusPublished SupportArticleStatus = "published"
	SupportArticleStatusHidden    SupportArticleStatus = "hidden"
	SupportArticleStatusDeleted   SupportArticleStatus = "deleted"
)

type SupportQuestionStatus string

const (
	SupportQuestionStatusPending  SupportQuestionStatus = "pending"
	SupportQuestionStatusNormal   SupportQuestionStatus = "normal"
	SupportQuestionStatusResolved SupportQuestionStatus = "resolved"
	SupportQuestionStatusClosed   SupportQuestionStatus = "closed"
	SupportQuestionStatusHidden   SupportQuestionStatus = "hidden"
	SupportQuestionStatusDeleted  SupportQuestionStatus = "deleted"
)

type SupportAnswerStatus string

const (
	SupportAnswerStatusNormal  SupportAnswerStatus = "normal"
	SupportAnswerStatusHidden  SupportAnswerStatus = "hidden"
	SupportAnswerStatusDeleted SupportAnswerStatus = "deleted"
)

type SupportAnswerAuthorType string

const (
	SupportAnswerAuthorTypeCustomer SupportAnswerAuthorType = "customer"
	SupportAnswerAuthorTypeUser     SupportAnswerAuthorType = "user"
)
