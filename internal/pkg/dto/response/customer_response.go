package response

import "agent-desk/internal/pkg/enums"

type CustomerIdentityResponse struct {
	ID             int64                `json:"id"`
	CustomerID     int64                `json:"customerId"`
	ExternalSource enums.ExternalSource `json:"externalSource"`
	ExternalID     string               `json:"externalId"`
	Status         enums.Status         `json:"status"`
	CreatedAt      string               `json:"createdAt,omitempty"`
}

type CustomerResponse struct {
	ID            int64                      `json:"id"`
	Name          string                     `json:"name"`
	Gender        enums.Gender               `json:"gender"`
	CompanyID     int64                      `json:"companyId"`
	Company       *CompanyResponse           `json:"company"`
	LastActiveAt  string                     `json:"lastActiveAt"`
	PrimaryMobile string                     `json:"primaryMobile"`
	PrimaryEmail  string                     `json:"primaryEmail"`
	Status        enums.Status               `json:"status"`
	Remark        string                     `json:"remark"`
	Identities    []CustomerIdentityResponse `json:"identities,omitempty"`
	Channels      []string                   `json:"channels,omitempty"`
	CreatedAt     string                     `json:"createdAt"`
	UpdatedAt     string                     `json:"updatedAt"`
}
