package services

import (
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"
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
	secondChild, err := SupportService.SaveHelpPage(request.SaveSupportHelpPageRequest{
		ParentID: root.ID, Title: "Configure", Slug: "configure", ContentType: "markdown", Content: "# Configure", Status: enums.SupportHelpPageStatusDraft,
	}, operator)
	if err != nil {
		t.Fatalf("create second child page: %v", err)
	}
	if err := SupportService.SortHelpPages(request.SortSupportHelpPagesRequest{
		ParentID: root.ID,
		IDs:      []int64{secondChild.ID, child.ID},
	}); err != nil {
		t.Fatalf("sort sibling pages: %v", err)
	}
	sorted := SupportService.FindHelpPages(sqls.NewCnd().Eq("parent_id", root.ID).Asc("sort_no"))
	if len(sorted) != 2 || sorted[0].ID != secondChild.ID || sorted[1].ID != child.ID {
		t.Fatalf("unexpected sorted pages: %#v", sorted)
	}
	if err := SupportService.SortHelpPages(request.SortSupportHelpPagesRequest{
		ParentID: root.ID,
		IDs:      []int64{child.ID},
	}); err == nil {
		t.Fatal("expected incomplete sibling sort to fail")
	}
	if _, err := SupportService.ChangeHelpPageStatus(request.ChangeSupportHelpPageStatusRequest{ID: root.ID, Status: enums.SupportHelpPageStatusDraft}, operator); err == nil {
		t.Fatal("expected withdrawing a parent with published children to fail")
	}
	if _, err := SupportService.ChangeHelpPageStatus(request.ChangeSupportHelpPageStatusRequest{ID: child.ID, Status: enums.SupportHelpPageStatusDraft}, operator); err != nil {
		t.Fatalf("withdraw child page: %v", err)
	}
	if _, err := SupportService.ChangeHelpPageStatus(request.ChangeSupportHelpPageStatusRequest{ID: root.ID, Status: enums.SupportHelpPageStatusDraft}, operator); err != nil {
		t.Fatalf("withdraw root page: %v", err)
	}
	if _, err := SupportService.ChangeHelpPageStatus(request.ChangeSupportHelpPageStatusRequest{ID: child.ID, Status: enums.SupportHelpPageStatusPublished}, operator); err == nil {
		t.Fatal("expected publishing a child under a draft parent to fail")
	}
	if _, err := SupportService.ChangeHelpPageStatus(request.ChangeSupportHelpPageStatusRequest{ID: root.ID, Status: enums.SupportHelpPageStatusPublished}, operator); err != nil {
		t.Fatalf("publish root page: %v", err)
	}
	if _, err := SupportService.ChangeHelpPageStatus(request.ChangeSupportHelpPageStatusRequest{ID: child.ID, Status: enums.SupportHelpPageStatusPublished}, operator); err != nil {
		t.Fatalf("publish child page: %v", err)
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
	if err := SupportService.DeleteHelpPage(secondChild.ID); err != nil {
		t.Fatalf("delete second leaf page: %v", err)
	}
}

func TestFindPublicHelpNavigationSelectsPublishedMetadataInTreeOrder(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.SupportHelpPage{}); err != nil {
		t.Fatalf("migrate help page: %v", err)
	}
	sqls.SetDB(db)
	items := []*models.SupportHelpPage{
		{ParentID: 0, Title: "Install", Slug: "install", Content: "install content", Status: enums.SupportHelpPageStatusPublished, SortNo: 0},
		{ParentID: 0, Title: "Overview", Slug: "overview", Content: "overview content", Status: enums.SupportHelpPageStatusPublished, SortNo: 1},
		{ParentID: 2, Title: "Change log", Slug: "changelog", Content: "change log content", Status: enums.SupportHelpPageStatusPublished, SortNo: 0},
		{ParentID: 0, Title: "Draft", Slug: "draft", Content: "draft content", Status: enums.SupportHelpPageStatusDraft, SortNo: 0},
	}
	for _, item := range items {
		if err := db.Create(item).Error; err != nil {
			t.Fatalf("create help page: %v", err)
		}
	}

	list := SupportService.FindPublicHelpNavigation()
	if len(list) != 3 || list[0].Slug != "install" || list[1].Slug != "changelog" || list[2].Slug != "overview" {
		t.Fatalf("unexpected navigation rows: %#v", list)
	}
	if list[0].Content != "" || list[1].Content != "" || list[2].Content != "" {
		t.Fatalf("navigation query must not load article content: %#v", list)
	}
}

func TestSupportSlugAllowsLettersNumbersAndHyphens(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.SupportHelpPage{}, &models.SupportQuestionCategory{}); err != nil {
		t.Fatalf("migrate support models: %v", err)
	}
	sqls.SetDB(db)
	operator := &dto.AuthPrincipal{UserID: 1, Username: "admin"}

	page, err := SupportService.SaveHelpPage(request.SaveSupportHelpPageRequest{
		Title: "Release notes", Slug: "release-2026-08", ContentType: "markdown", Status: enums.SupportHelpPageStatusDraft,
	}, operator)
	if err != nil {
		t.Fatalf("save slug containing hyphens: %v", err)
	}
	if page.Slug != "release-2026-08" {
		t.Fatalf("unexpected saved slug: %q", page.Slug)
	}
	category, err := SupportService.SaveQuestionCategory(request.SaveSupportQuestionCategoryRequest{
		Name: "Release notes", Slug: "release-2026-08",
	}, operator)
	if err != nil {
		t.Fatalf("save category slug containing hyphens: %v", err)
	}
	if category.Slug != "release-2026-08" {
		t.Fatalf("unexpected saved category slug: %q", category.Slug)
	}
	if _, err := SupportService.SaveHelpPage(request.SaveSupportHelpPageRequest{
		Title: "Invalid slug", Slug: "release_notes", ContentType: "markdown", Status: enums.SupportHelpPageStatusDraft,
	}, operator); err == nil {
		t.Fatal("expected underscore slug to fail validation")
	}
	if err := db.Create(&models.SupportHelpPage{ParentID: 0, Title: "Root", Slug: "shared-slug"}).Error; err != nil {
		t.Fatalf("create first root slug: %v", err)
	}
	if err := db.Create(&models.SupportHelpPage{ParentID: 1, Title: "Child", Slug: "shared-slug"}).Error; err != nil {
		t.Fatalf("allow the same slug under another parent: %v", err)
	}
	if err := db.Create(&models.SupportHelpPage{ParentID: 0, Title: "Duplicate root", Slug: "shared-slug"}).Error; err == nil {
		t.Fatal("expected duplicate slug under the same parent to fail")
	}
}

func TestSupportQuestionCategorySort(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+strings.ReplaceAll(t.Name(), "/", "_")+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&models.SupportQuestionCategory{}); err != nil {
		t.Fatalf("migrate category: %v", err)
	}
	sqls.SetDB(db)
	categories := []*models.SupportQuestionCategory{
		{Name: "First", Slug: "first", SortNo: 0, Status: enums.StatusOk},
		{Name: "Second", Slug: "second", SortNo: 1, Status: enums.StatusOk},
		{Name: "Third", Slug: "third", SortNo: 2, Status: enums.StatusOk},
	}
	for _, category := range categories {
		if err := db.Create(category).Error; err != nil {
			t.Fatalf("create category: %v", err)
		}
	}
	if err := SupportService.UpdateQuestionCategorySort([]int64{categories[2].ID, categories[0].ID, categories[1].ID}); err != nil {
		t.Fatalf("sort categories: %v", err)
	}
	sorted := repositories.SupportQuestionCategoryRepository.Find(sqls.DB(), sqls.NewCnd().Asc("sort_no"))
	if len(sorted) != 3 || sorted[0].ID != categories[2].ID || sorted[1].ID != categories[0].ID || sorted[2].ID != categories[1].ID {
		t.Fatalf("unexpected sorted categories: %#v", sorted)
	}
}
