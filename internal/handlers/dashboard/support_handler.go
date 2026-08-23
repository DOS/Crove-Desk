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

func SupportCategoryAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.SupportCategoryRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "name", Op: params.Like},
	).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: builders.BuildSupportPostCategories(list), Page: paging})
}

func SupportCategoryGetList_all(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := repositories.SupportCategoryRepository.Find(sqls.DB(), sqls.NewCnd().Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, builders.BuildSupportPostCategories(list))
}

func SupportCategoryPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveSupportCategoryRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveCategory(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportCategory(item))
}

func SupportCategoryPostUpdate(ctx *gin.Context) {
	SupportCategoryPostCreate(ctx)
}

func SupportCategoryPostUpdateSort(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostUpdate); err != nil {
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

func SupportCategoryPostDelete(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostUpdate); err != nil {
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

func SupportPostAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.SupportPostRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "categoryId"},
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: buildDashboardSupportPosts(list), Page: paging})
}

func SupportPostGetBy(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	post := repositories.SupportPostRepository.Get(sqls.DB(), id)
	if post == nil {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	comments := repositories.SupportCommentRepository.Find(sqls.DB(), sqls.NewCnd().Eq("post_id", id).Desc("is_accepted").Asc("id"))
	httpx.WriteJSON(ctx, response.SupportPostDetailResponse{Post: *builders.BuildSupportPost(post, dashboardSupportCategoryName(post.CategoryID), dashboardSupportUser(post.UserID)), Comments: buildDashboardSupportComments(comments)})
}

func SupportPostPostModerate(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ModerateSupportPostRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ModeratePost(req))
}

func SupportPostPostAcceptComment(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportAcceptCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.AcceptComment(req, nil, operator))
}

func SupportCommentPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateSupportCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.CreateUserComment(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportComment(item, operator.Nickname))
}

func SupportCommentPostModerate(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportPostUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ModerateSupportCommentRequest{}
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

func buildDashboardSupportPosts(list []models.SupportPost) []response.SupportPostResponse {
	results := make([]response.SupportPostResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportPost(&item, dashboardSupportCategoryName(item.CategoryID), dashboardSupportUser(item.UserID)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func buildDashboardSupportComments(list []models.SupportComment) []response.SupportCommentResponse {
	results := make([]response.SupportCommentResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportComment(&item, dashboardSupportCommentAuthorName(item)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func dashboardSupportCategoryName(id int64) string {
	item := repositories.SupportCategoryRepository.Get(sqls.DB(), id)
	if item == nil {
		return ""
	}
	return item.Name
}

func dashboardSupportUser(id int64) *models.User {
	return repositories.UserRepository.Get(sqls.DB(), id)
}

func dashboardSupportCommentAuthorName(item models.SupportComment) string {
	user := repositories.UserRepository.Get(sqls.DB(), item.AuthorID)
	if user == nil {
		return ""
	}
	if user.Nickname != "" {
		return user.Nickname
	}
	return user.Username
}
