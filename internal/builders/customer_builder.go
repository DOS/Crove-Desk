package builders

import (
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/repositories"
	"agent-desk/internal/services"

	"github.com/mlogclub/simple/sqls"
)

func BuildCustomer(item *models.Customer) *response.CustomerResponse {
	if item == nil {
		return nil
	}
	var identities []models.CustomerIdentity
	if sqls.DB() != nil {
		identities = repositories.CustomerIdentityRepository.FindByCustomerID(sqls.DB(), item.ID)
	}
	identityResponses := make([]response.CustomerIdentityResponse, 0, len(identities))
	channels := make([]string, 0, len(identities))
	channelSeen := make(map[string]bool)
	for _, idn := range identities {
		identityResponses = append(identityResponses, response.CustomerIdentityResponse{
			ID:             idn.ID,
			CustomerID:     idn.CustomerID,
			ExternalSource: idn.ExternalSource,
			ExternalID:     idn.ExternalID,
			Status:         idn.Status,
			CreatedAt:      utils.FormatTime(idn.CreatedAt),
		})
		src := string(idn.ExternalSource)
		if !channelSeen[src] && src != "" {
			channelSeen[src] = true
			channels = append(channels, src)
		}
	}

	return &response.CustomerResponse{
		ID:            item.ID,
		Name:          item.Name,
		Gender:        item.Gender,
		CompanyID:     item.CompanyID,
		Company:       BuildCompany(services.CompanyService.Get(item.CompanyID)),
		LastActiveAt:  utils.FormatTimePtr(item.LastActiveAt),
		PrimaryMobile: item.PrimaryMobile,
		PrimaryEmail:  item.PrimaryEmail,
		Status:        item.Status,
		Remark:        item.Remark,
		Identities:    identityResponses,
		Channels:      channels,
		CreatedAt:     item.CreatedAt.Format(time.DateTime),
		UpdatedAt:     item.UpdatedAt.Format(time.DateTime),
	}
}

func BuildCustomerList(list []models.Customer) []response.CustomerResponse {
	if len(list) == 0 {
		return []response.CustomerResponse{}
	}
	customerIDs := make([]int64, 0, len(list))
	for _, item := range list {
		customerIDs = append(customerIDs, item.ID)
	}
	var allIdentities []models.CustomerIdentity
	if sqls.DB() != nil {
		allIdentities = repositories.CustomerIdentityRepository.Find(sqls.DB(), sqls.NewCnd().In("customer_id", customerIDs).Eq("status", enums.StatusOk).Desc("id"))
	}
	identityMap := make(map[int64][]response.CustomerIdentityResponse)
	channelMap := make(map[int64][]string)
	channelSeen := make(map[int64]map[string]bool)

	for _, idn := range allIdentities {
		identityMap[idn.CustomerID] = append(identityMap[idn.CustomerID], response.CustomerIdentityResponse{
			ID:             idn.ID,
			CustomerID:     idn.CustomerID,
			ExternalSource: idn.ExternalSource,
			ExternalID:     idn.ExternalID,
			Status:         idn.Status,
			CreatedAt:      utils.FormatTime(idn.CreatedAt),
		})
		src := string(idn.ExternalSource)
		if channelSeen[idn.CustomerID] == nil {
			channelSeen[idn.CustomerID] = make(map[string]bool)
		}
		if !channelSeen[idn.CustomerID][src] && src != "" {
			channelSeen[idn.CustomerID][src] = true
			channelMap[idn.CustomerID] = append(channelMap[idn.CustomerID], src)
		}
	}

	results := make([]response.CustomerResponse, 0, len(list))
	for _, item := range list {
		c := response.CustomerResponse{
			ID:            item.ID,
			Name:          item.Name,
			Gender:        item.Gender,
			CompanyID:     item.CompanyID,
			Company:       BuildCompany(services.CompanyService.Get(item.CompanyID)),
			LastActiveAt:  utils.FormatTimePtr(item.LastActiveAt),
			PrimaryMobile: item.PrimaryMobile,
			PrimaryEmail:  item.PrimaryEmail,
			Status:        item.Status,
			Remark:        item.Remark,
			Identities:    identityMap[item.ID],
			Channels:      channelMap[item.ID],
			CreatedAt:     item.CreatedAt.Format(time.DateTime),
			UpdatedAt:     item.UpdatedAt.Format(time.DateTime),
		}
		results = append(results, c)
	}
	return results
}
