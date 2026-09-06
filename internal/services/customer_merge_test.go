package services_test

import (
	"testing"
	"time"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/openidentity"
	"agent-desk/internal/services"

	"github.com/mlogclub/simple/sqls"
)

func TestMergeCustomer_Success(t *testing.T) {
	db := setupCustomerServiceTestDB(t)
	now := time.Now()
	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}

	// 1. Create Target Customer (Customer A: has email)
	var targetID int64
	_ = sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		id, err := services.CustomerService.EnsureExternalCustomer(ctx, openidentity.ExternalUser{
			ExternalSource: enums.ExternalSourceEmail,
			ExternalID:     "john@acme.com",
			ExternalName:   "John Doe (Email)",
		})
		targetID = id
		return err
	})

	_ = db.Model(&models.Customer{}).Where("id = ?", targetID).Updates(map[string]any{
		"primary_email": "john@acme.com",
	})

	// 2. Create Source Customer (Customer B: has Telegram and same email contact)
	var sourceID int64
	_ = sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		id, err := services.CustomerService.EnsureExternalCustomer(ctx, openidentity.ExternalUser{
			ExternalSource: enums.ExternalSourceTelegram,
			ExternalID:     "tg_12345678",
			ExternalName:   "John Telegram",
		})
		sourceID = id
		return err
	})

	_ = db.Model(&models.Customer{}).Where("id = ?", sourceID).Updates(map[string]any{
		"primary_mobile": "+1234567890",
	})

	// Add contacts to source
	_ = db.Create(&models.CustomerContact{
		CustomerID:   sourceID,
		ContactType:  enums.ContactTypeMobile,
		ContactValue: "+1234567890",
		IsPrimary:    true,
		Status:       enums.StatusOk,
		AuditFields:  models.AuditFields{CreatedAt: now, UpdatedAt: now},
	})

	// Add conversations to source and target
	convSource := &models.Conversation{
		CustomerID:   sourceID,
		CustomerName: "John Telegram",
		Status:       enums.IMConversationStatusActive,
		AuditFields:  models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(convSource)

	convTarget := &models.Conversation{
		CustomerID:   targetID,
		CustomerName: "John Doe (Email)",
		Status:       enums.IMConversationStatusActive,
		AuditFields:  models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(convTarget)

	// Add ticket to source
	ticketSource := &models.Ticket{
		TicketNo:    "T-0001",
		Title:       "Telegram issue",
		CustomerID:  sourceID,
		Status:      enums.TicketStatusPending,
		AuditFields: models.AuditFields{CreatedAt: now, UpdatedAt: now},
	}
	_ = db.Create(ticketSource)

	// 3. Execute Merge
	merged, err := services.CustomerService.MergeCustomer(request.MergeCustomerRequest{
		TargetCustomerID: targetID,
		SourceCustomerID: sourceID,
		Reason:           "Same customer identified across Telegram and Email",
	}, operator)
	if err != nil {
		t.Fatalf("MergeCustomer() error = %v", err)
	}

	if merged == nil || merged.ID != targetID {
		t.Fatalf("expected merged customer ID %d, got %+v", targetID, merged)
	}

	// 4. Verify Target Customer now has moved primary_mobile
	if merged.PrimaryMobile != "+1234567890" {
		t.Errorf("expected target primary mobile to be '+1234567890', got %q", merged.PrimaryMobile)
	}
	if merged.PrimaryEmail != "john@acme.com" {
		t.Errorf("expected target primary email to be 'john@acme.com', got %q", merged.PrimaryEmail)
	}

	// 5. Verify Source Customer is marked StatusDeleted
	sourceCustomer := services.CustomerService.Get(sourceID)
	if sourceCustomer == nil || sourceCustomer.Status != enums.StatusDeleted {
		t.Errorf("expected source customer to be deleted, got %+v", sourceCustomer)
	}

	// 6. Verify Source Conversation was transferred to Target Customer
	var updatedConv models.Conversation
	if err := db.First(&updatedConv, convSource.ID).Error; err != nil {
		t.Fatalf("find updated conv error = %v", err)
	}
	if updatedConv.CustomerID != targetID {
		t.Errorf("expected conv customerID to be %d, got %d", targetID, updatedConv.CustomerID)
	}

	// 7. Verify Source Ticket was transferred to Target Customer
	var updatedTicket models.Ticket
	if err := db.First(&updatedTicket, ticketSource.ID).Error; err != nil {
		t.Fatalf("find updated ticket error = %v", err)
	}
	if updatedTicket.CustomerID != targetID {
		t.Errorf("expected ticket customerID to be %d, got %d", targetID, updatedTicket.CustomerID)
	}

	// 8. Verify CustomerIdentities: Target now has both Email and Telegram identities
	var identities []models.CustomerIdentity
	db.Where("customer_id = ? AND status = ?", targetID, enums.StatusOk).Find(&identities)
	if len(identities) != 2 {
		t.Errorf("expected 2 active identities for target, got %d", len(identities))
	}
}
