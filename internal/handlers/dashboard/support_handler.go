package dashboard

import (
	"agent-desk/internal/builders"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/constants"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/httpx"
	"agent-desk/internal/pkg/httpx/params"
	"agent-desk/internal/repositories"
	"agent-desk/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/sqls"
	"github.com/mlogclub/simple/web"
)

func SupportHelpPageAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := services.SupportService.FindHelpPagePage(params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "parentId"},
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: buildDashboardSupportHelpPages(list, false), Page: paging})
}

func SupportHelpPageGetList_all(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := services.SupportService.FindHelpPages(sqls.NewCnd().Asc("sort_no").Asc("id"))
	httpx.WriteJSON(ctx, buildDashboardSupportHelpPages(list, false))
}

func SupportHelpPageGetBy(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	item := services.SupportService.FindHelpPageByID(id)
	if item == nil {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportHelpPage(item, true))
}

func SupportHelpPagePostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageCreate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveSupportHelpPageRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveHelpPage(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportHelpPage(item, true))
}

func SupportHelpPagePostUpdate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveSupportHelpPageRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveHelpPage(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportHelpPage(item, true))
}

func SupportHelpPagePostUpdate_settings(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.UpdateSupportHelpPageSettingsRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.UpdateHelpPageSettings(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportHelpPage(item, true))
}

func SupportHelpPagePostDelete(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageDelete); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.DeleteByIDRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.DeleteHelpPage(req.ID))
}

func SupportHelpPagePostUpdate_sort(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SortSupportHelpPagesRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.SortHelpPages(req))
}

func SupportHelpPagePostChange_status(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportHelpPageUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ChangeSupportHelpPageStatusRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.ChangeHelpPageStatus(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportHelpPage(item, true))
}

func CategoryAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.CategoryRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "name", Op: params.Like},
	).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: builders.BuildPostCategories(list), Page: paging})
}

func CategoryGetList_all(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := repositories.CategoryRepository.Find(sqls.DB(), sqls.NewCnd().Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, builders.BuildPostCategories(list))
}

func CategoryPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveCategoryRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveCategory(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildCategory(item))
}

func CategoryPostUpdate(ctx *gin.Context) {
	CategoryPostCreate(ctx)
}

func CategoryPostUpdateSort(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	var ids []int64
	if err := params.ReadJSON(ctx, &ids); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.SupportService.UpdateCategorySort(ids); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
}

func CategoryPostDelete(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.DeleteByIDRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.DeleteCategory(req.ID))
}

func PostAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.PostRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "categoryId"},
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: buildDashboardPosts(list), Page: paging})
}

func PostGetBy(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	post := repositories.PostRepository.Get(sqls.DB(), id)
	if post == nil {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	comments := repositories.CommentRepository.Find(sqls.DB(), sqls.NewCnd().Eq("post_id", id).Desc("is_accepted").Asc("id"))
	httpx.WriteJSON(ctx, response.PostDetailResponse{Post: *builders.BuildPost(post, dashboardCategoryName(post.CategoryID), dashboardSupportUser(post.UserID)), Comments: buildDashboardComments(comments)})
}

func PostPostModerate(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ModeratePostRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ModeratePost(req))
}

func PostPostAcceptComment(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.AcceptCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.AcceptComment(req, nil, operator))
}

func CommentPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.CreateUserComment(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildComment(item, operator.Nickname))
}

func CommentPostModerate(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionCommunityUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ModerateCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ModerateComment(req))
}

func buildDashboardSupportHelpPages(list []models.SupportHelpPage, includeContent bool) []response.SupportHelpPageResponse {
	results := make([]response.SupportHelpPageResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportHelpPage(&item, includeContent); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func buildDashboardPosts(list []models.Post) []response.PostResponse {
	results := make([]response.PostResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildPost(&item, dashboardCategoryName(item.CategoryID), dashboardSupportUser(item.UserID)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func buildDashboardComments(list []models.Comment) []response.CommentResponse {
	results := make([]response.CommentResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildComment(&item, dashboardCommentAuthorName(item)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func dashboardCategoryName(id int64) string {
	item := repositories.CategoryRepository.Get(sqls.DB(), id)
	if item == nil {
		return ""
	}
	return item.Name
}

func dashboardSupportUser(id int64) *models.User {
	return repositories.UserRepository.Get(sqls.DB(), id)
}

func dashboardCommentAuthorName(item models.Comment) string {
	user := repositories.UserRepository.Get(sqls.DB(), item.AuthorID)
	if user == nil {
		return ""
	}
	if user.Nickname != "" {
		return user.Nickname
	}
	return user.Username
}
