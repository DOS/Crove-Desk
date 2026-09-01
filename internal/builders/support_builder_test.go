package builders

import (
	"agent-desk/internal/models"
	"testing"
)

func TestBuildDocPageNavigationTree(t *testing.T) {
	menu := BuildDocPageNavigationTree([]models.DocPage{
		{ID: 1, Title: "Install", Slug: "install"},
		{ID: 2, Title: "Overview", Slug: "overview"},
		{ID: 3, ParentID: 2, Title: "Change log", Slug: "changelog"},
	})
	if len(menu) != 2 || menu[0].Slug != "install" || menu[1].Slug != "overview" || len(menu[1].Children) != 1 || menu[1].Children[0].Slug != "changelog" {
		t.Fatalf("unexpected navigation tree: %#v", menu)
	}
}
