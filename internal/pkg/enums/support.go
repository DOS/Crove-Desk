package enums

type SupportHelpPageStatus string

const (
	SupportHelpPageStatusDraft     SupportHelpPageStatus = "draft"
	SupportHelpPageStatusPublished SupportHelpPageStatus = "published"
	SupportHelpPageStatusHidden    SupportHelpPageStatus = "hidden"
	SupportHelpPageStatusDeleted   SupportHelpPageStatus = "deleted"
)

type SupportPostStatus string

const (
	SupportPostStatusPending  SupportPostStatus = "pending"
	SupportPostStatusNormal   SupportPostStatus = "normal"
	SupportPostStatusResolved SupportPostStatus = "resolved"
	SupportPostStatusClosed   SupportPostStatus = "closed"
	SupportPostStatusHidden   SupportPostStatus = "hidden"
	SupportPostStatusDeleted  SupportPostStatus = "deleted"
)

type SupportCommentStatus string

const (
	SupportCommentStatusNormal  SupportCommentStatus = "normal"
	SupportCommentStatusHidden  SupportCommentStatus = "hidden"
	SupportCommentStatusDeleted SupportCommentStatus = "deleted"
)

type SupportCommentAuthorType string

const (
	SupportCommentAuthorTypeUser     SupportCommentAuthorType = "user"
	SupportCommentAuthorTypeEmployee SupportCommentAuthorType = "employee"
)

type SupportReactionTarget string

const (
	SupportReactionTargetPost    SupportReactionTarget = "post"
	SupportReactionTargetComment SupportReactionTarget = "comment"
)

type SupportReactionType string

const (
	SupportReactionTypeLike SupportReactionType = "like"
)

type UserType string

const (
	UserTypeUser     UserType = "user"
	UserTypeEmployee UserType = "employee"
)
