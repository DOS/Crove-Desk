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

func SupportArticleCategoryAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportCategoryView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.SupportArticleCategoryRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "name", Op: params.Like},
	).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: builders.BuildSupportArticleCategories(list), Page: paging})
}

func SupportArticleCategoryGetList_all(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportCategoryView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := repositories.SupportArticleCategoryRepository.Find(sqls.DB(), sqls.NewCnd().Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, builders.BuildSupportArticleCategories(list))
}

func SupportArticleCategoryPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportCategoryUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveSupportArticleCategoryRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveArticleCategory(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportArticleCategory(item))
}

func SupportArticleCategoryPostUpdate(ctx *gin.Context) {
	SupportArticleCategoryPostCreate(ctx)
}

func SupportArticleCategoryPostDelete(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportCategoryUpdate); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.DeleteByIDRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, repositories.SupportArticleCategoryRepository.Delete(sqls.DB(), req.ID))
}

func SupportArticleAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportArticleView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list, paging := repositories.SupportArticleRepository.FindPageByCnd(sqls.DB(), params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "categoryId"},
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, &web.PageResult{Results: buildDashboardSupportArticles(list, false), Page: paging})
}

func SupportArticleGetBy(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportArticleView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	item := repositories.SupportArticleRepository.Get(sqls.DB(), id)
	if item == nil {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportArticle(item, dashboardSupportArticleCategoryName(item.CategoryID), true))
}

func SupportArticlePostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportArticleCreate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveSupportArticleRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveArticle(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportArticle(item, dashboardSupportArticleCategoryName(item.CategoryID), true))
}

func SupportArticlePostUpdate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportArticleUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SaveSupportArticleRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.SaveArticle(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportArticle(item, dashboardSupportArticleCategoryName(item.CategoryID), true))
}

func SupportArticlePostDelete(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportArticleDelete); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.DeleteByIDRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, repositories.SupportArticleRepository.Delete(sqls.DB(), req.ID))
}

func SupportQuestionCategoryAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportCategoryView); err != nil {
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
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportCategoryView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := repositories.SupportQuestionCategoryRepository.Find(sqls.DB(), sqls.NewCnd().Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, builders.BuildSupportQuestionCategories(list))
}

func SupportQuestionCategoryPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionSupportCategoryUpdate)
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

func buildDashboardSupportArticles(list []models.SupportArticle, includeContent bool) []response.SupportArticleResponse {
	results := make([]response.SupportArticleResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportArticle(&item, dashboardSupportArticleCategoryName(item.CategoryID), includeContent); resp != nil {
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

func dashboardSupportArticleCategoryName(id int64) string {
	item := repositories.SupportArticleCategoryRepository.Get(sqls.DB(), id)
	if item == nil {
		return ""
	}
	return item.Name
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
