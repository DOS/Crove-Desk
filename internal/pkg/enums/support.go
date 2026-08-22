package enums

type SupportHelpPageStatus string

const (
	SupportHelpPageStatusDraft     SupportHelpPageStatus = "draft"
	SupportHelpPageStatusPublished SupportHelpPageStatus = "published"
	SupportHelpPageStatusHidden    SupportHelpPageStatus = "hidden"
	SupportHelpPageStatusDeleted   SupportHelpPageStatus = "deleted"
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
	SupportAnswerAuthorTypeUser     SupportAnswerAuthorType = "user"
	SupportAnswerAuthorTypeEmployee SupportAnswerAuthorType = "employee"
)

type UserType string

const (
	UserTypeUser     UserType = "user"
	UserTypeEmployee UserType = "employee"
)
