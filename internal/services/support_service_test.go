package services

import (
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestSupportHelpPageHierarchy(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.SupportHelpPage{}); err != nil {
		t.Fatalf("migrate help page: %v", err)
	}
	sqls.SetDB(db)
	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}

	root, err := SupportService.SaveHelpPage(request.SaveSupportHelpPageRequest{
		Title: "Getting Started", Slug: "getting-started", ContentType: "markdown", Content: "# Getting Started", Status: enums.SupportHelpPageStatusPublished,
	}, operator)
	if err != nil {
		t.Fatalf("create root page: %v", err)
	}
	child, err := SupportService.SaveHelpPage(request.SaveSupportHelpPageRequest{
		ParentID: root.ID, Title: "Install", Slug: "install", ContentType: "markdown", Content: "# Install", Status: enums.SupportHelpPageStatusPublished,
	}, operator)
	if err != nil {
		t.Fatalf("create child page under a content page: %v", err)
	}
	_, err = SupportService.SaveHelpPage(request.SaveSupportHelpPageRequest{
		ID: root.ID, Title: root.Title, Slug: root.Slug, ContentType: root.ContentType, Content: root.Content, Status: enums.SupportHelpPageStatusDraft,
	}, operator)
	if err == nil {
		t.Fatal("expected unpublishing a parent with published children to fail")
	}

	root.ParentID = child.ID
	_, err = SupportService.SaveHelpPage(request.SaveSupportHelpPageRequest{
		ID: root.ID, ParentID: child.ID, Title: root.Title, Slug: root.Slug, ContentType: root.ContentType, Content: root.Content, Status: root.Status,
	}, operator)
	if err == nil {
		t.Fatal("expected cycle validation error")
	}
	if err := SupportService.DeleteHelpPage(root.ID); err == nil {
		t.Fatal("expected deleting a page with children to fail")
	}
	if err := SupportService.DeleteHelpPage(child.ID); err != nil {
		t.Fatalf("delete leaf page: %v", err)
	}
}
