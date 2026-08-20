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

func SupportQuestionCategoryAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.SupportQuestionCategoryRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "name", Op: params.Like},
	).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: builders.BuildSupportQuestionCategories(list), Page: paging})
}

func SupportQuestionCategoryGetList_all(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := repositories.SupportQuestionCategoryRepository.Find(sqls.DB(), sqls.NewCnd().Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, builders.BuildSupportQuestionCategories(list))
}

func SupportQuestionCategoryPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveSupportQuestionCategoryRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveQuestionCategory(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportQuestionCategory(item))
}

func SupportQuestionCategoryPostUpdate(ctx *gin.Context) {
	SupportQuestionCategoryPostCreate(ctx)
}

func SupportQuestionCategoryPostUpdateSort(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	var ids []int64
	if err := params.ReadJSON(ctx, &ids); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.SupportService.UpdateQuestionCategorySort(ids); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
}

func SupportQuestionCategoryPostDelete(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.DeleteByIDRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.DeleteQuestionCategory(req.ID))
}

func SupportQuestionAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.SupportQuestionRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "categoryId"},
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: buildDashboardSupportQuestions(list), Page: paging})
}

func SupportQuestionGetBy(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	question := repositories.SupportQuestionRepository.Get(sqls.DB(), id)
	if question == nil {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	answers := repositories.SupportAnswerRepository.Find(sqls.DB(), sqls.NewCnd().Eq("question_id", id).Desc("is_best_answer").Asc("id"))
	httpx.WriteJSON(ctx, response.SupportQuestionDetailResponse{Question: *builders.BuildSupportQuestion(question, dashboardSupportQuestionCategoryName(question.CategoryID), dashboardSupportUser(question.UserID)), Answers: buildDashboardSupportAnswers(answers)})
}

func SupportQuestionPostModerate(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ModerateSupportQuestionRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ModerateQuestion(req))
}

func SupportQuestionPostAcceptAnswer(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportAcceptAnswerRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.AcceptAnswer(req, nil, operator))
}

func SupportAnswerPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateSupportAnswerRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.CreateUserAnswer(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportAnswer(item, operator.Nickname))
}

func SupportAnswerPostModerate(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportQuestionUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ModerateSupportAnswerRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ModerateAnswer(req))
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

func buildDashboardSupportQuestions(list []models.SupportQuestion) []response.SupportQuestionResponse {
	results := make([]response.SupportQuestionResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportQuestion(&item, dashboardSupportQuestionCategoryName(item.CategoryID), dashboardSupportUser(item.UserID)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func buildDashboardSupportAnswers(list []models.SupportAnswer) []response.SupportAnswerResponse {
	results := make([]response.SupportAnswerResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportAnswer(&item, dashboardSupportAnswerAuthorName(item)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func dashboardSupportQuestionCategoryName(id int64) string {
	item := repositories.SupportQuestionCategoryRepository.Get(sqls.DB(), id)
	if item == nil {
		return ""
	}
	return item.Name
}

func dashboardSupportUser(id int64) *models.User {
	return repositories.UserRepository.Get(sqls.DB(), id)
}

func dashboardSupportAnswerAuthorName(item models.SupportAnswer) string {
	user := repositories.UserRepository.Get(sqls.DB(), item.AuthorID)
	if user == nil {
		return ""
	}
	if user.Nickname != "" {
		return user.Nickname
	}
	return user.Username
}
