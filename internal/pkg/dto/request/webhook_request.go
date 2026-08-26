package request

type OrgSyncEventData struct {
	OrgID        string `json:"org_id"`
	ID           string `json:"id,omitempty"`
	OrgName      string `json:"org_name"`
	Name         string `json:"name,omitempty"`
	Slug         string `json:"slug,omitempty"`
	UserID       string `json:"user_id"`
	UserEmail    string `json:"user_email"`
	BillingEmail string `json:"billingEmail,omitempty"`
	UserName     string `json:"user_name"`
	Role         string `json:"role"`
	Plan         string `json:"plan"`
}

type OrgSyncWebhookRequest struct {
	Event     string           `json:"event"`
	Timestamp string           `json:"timestamp"`
	Data      OrgSyncEventData `json:"data"`
}

type DOSOrgSyncEventData = OrgSyncEventData
type DOSOrgSyncWebhookRequest = OrgSyncWebhookRequest
