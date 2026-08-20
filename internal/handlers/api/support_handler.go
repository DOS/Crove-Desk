package api

import (
	"agent-desk/internal/builders"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/httpx"
	"agent-desk/internal/pkg/httpx/params"
	"agent-desk/internal/repositories"
	"agent-desk/internal/services"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/sqls"
	"github.com/mlogclub/simple/web"
	"gorm.io/gorm"
)

func SupportPostRegister(ctx *gin.Context) {
	req := request.SupportCustomerRegisterRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	ret, err := services.SupportService.RegisterUser(req, config.Current().Auth, ctx.ClientIP(), ctx.GetHeader("User-Agent"))
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, ret)
}

func SupportPostLogin(ctx *gin.Context) {
	req := request.SupportCustomerLoginRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	ret, err := services.AuthService.Login(request.LoginRequest{
		Username: req.Email,
		Password: req.Password,
	}, config.Current().Auth, ctx.ClientIP(), ctx.GetHeader("User-Agent"))
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, ret)
}

func SupportGetMe(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	user := supportUser(principal.UserID)
	email := ""
	if user != nil && user.Email != nil {
		email = *user.Email
	}
	httpx.WriteJSON(ctx, response.SupportUserResponse{ID: principal.UserID, Name: supportPrincipalDisplayName(principal.UserID), Email: email, UserType: principal.UserType})
}

func SupportHelpPageAnyList(ctx *gin.Context) {
	cnd := params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "parentId"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Eq("status", enums.SupportHelpPageStatusPublished).Asc("sort_no").Desc("id")
	if keyword := strings.TrimSpace(ctx.Query("keyword")); keyword != "" {
		pattern := "%" + keyword + "%"
		cnd.Where("(title LIKE ? OR summary LIKE ? OR content LIKE ? OR tags_json LIKE ? OR slug LIKE ?)", pattern, pattern, pattern, pattern, pattern)
	}
	list, paging := repositories.SupportHelpPageRepository.FindPageByCnd(sqls.DB(), cnd)
	results := buildSupportHelpPageList(list, false)
	httpx.WriteJSON(ctx, &web.PageResult{Results: results, Page: paging})
}

func SupportHelpPageGetNavigation(ctx *gin.Context) {
	list := services.SupportService.FindPublicHelpNavigation()
	httpx.WriteJSON(ctx, builders.BuildSupportHelpPageNavigationTree(list))
}

func SupportHelpPageGetBy(ctx *gin.Context) {
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	item := repositories.SupportHelpPageRepository.Get(sqls.DB(), id)
	if item == nil || item.Status != enums.SupportHelpPageStatusPublished {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	_ = repositories.SupportHelpPageRepository.UpdateColumn(sqls.DB(), item.ID, "view_count", gorm.Expr("view_count + ?", 1))
	httpx.WriteJSON(ctx, builders.BuildSupportHelpPage(item, true))
}

func SupportHelpPagePostFeedback(ctx *gin.Context) {
	req := request.SupportHelpPageFeedbackRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.FeedbackHelpPage(req))
}

func SupportQuestionCategoryAnyList(ctx *gin.Context) {
	list := repositories.SupportQuestionCategoryRepository.Find(sqls.DB(), sqls.NewCnd().Eq("status", enums.StatusOk).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, builders.BuildSupportQuestionCategories(list))
}

func SupportQuestionAnyList(ctx *gin.Context) {
	cnd := params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "categoryId"},
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Where("status NOT IN ?", []enums.SupportQuestionStatus{enums.SupportQuestionStatusHidden, enums.SupportQuestionStatusDeleted}).Desc("id")
	list, paging := repositories.SupportQuestionRepository.FindPageByCnd(sqls.DB(), cnd)
	results := buildSupportQuestionList(list)
	httpx.WriteJSON(ctx, &web.PageResult{Results: results, Page: paging})
}

func SupportQuestionGetBy(ctx *gin.Context) {
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	question := repositories.SupportQuestionRepository.Get(sqls.DB(), id)
	if question == nil || question.Status == enums.SupportQuestionStatusHidden || question.Status == enums.SupportQuestionStatusDeleted {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	_ = repositories.SupportQuestionRepository.UpdateColumn(sqls.DB(), question.ID, "view_count", gorm.Expr("view_count + ?", 1))
	answers := repositories.SupportAnswerRepository.Find(sqls.DB(), sqls.NewCnd().Eq("question_id", id).Eq("status", enums.SupportAnswerStatusNormal).Desc("is_best_answer").Asc("id"))
	httpx.WriteJSON(ctx, response.SupportQuestionDetailResponse{Question: *builders.BuildSupportQuestion(question, supportQuestionCategoryName(question.CategoryID), supportUser(question.UserID)), Answers: buildSupportAnswerList(answers)})
}

func SupportQuestionPostCreate(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateSupportQuestionRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.CreateQuestion(req, principal)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportQuestion(item, supportQuestionCategoryName(item.CategoryID), supportUser(principal.UserID)))
}

func SupportQuestionPostUpdate(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.UpdateSupportQuestionRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.UpdateQuestion(req, principal))
}

func SupportQuestionPostAcceptAnswer(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportAcceptAnswerRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.AcceptAnswer(req, principal, nil))
}

func SupportQuestionPostVote(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportVoteRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ToggleQuestionVote(req.ID, principal))
}

func SupportAnswerPostCreate(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateSupportAnswerRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.CreateSupportUserAnswer(req, principal)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportAnswer(item, supportPrincipalDisplayName(principal.UserID)))
}

func SupportAnswerPostVote(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportVoteRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ToggleAnswerVote(req.ID, principal))
}

func buildSupportHelpPageList(list []models.SupportHelpPage, includeContent bool) []response.SupportHelpPageResponse {
	results := make([]response.SupportHelpPageResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportHelpPage(&item, includeContent); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func buildSupportQuestionList(list []models.SupportQuestion) []response.SupportQuestionResponse {
	results := make([]response.SupportQuestionResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportQuestion(&item, supportQuestionCategoryName(item.CategoryID), supportUser(item.UserID)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func buildSupportAnswerList(list []models.SupportAnswer) []response.SupportAnswerResponse {
	results := make([]response.SupportAnswerResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportAnswer(&item, supportAnswerAuthorName(item)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func supportQuestionCategoryName(id int64) string {
	item := repositories.SupportQuestionCategoryRepository.Get(sqls.DB(), id)
	if item == nil {
		return ""
	}
	return item.Name
}

func supportUser(id int64) *models.User {
	return repositories.UserRepository.Get(sqls.DB(), id)
}

func supportPrincipalDisplayName(id int64) string {
	user := supportUser(id)
	if user == nil {
		return ""
	}
	if user.Nickname != "" {
		return user.Nickname
	}
	return user.Username
}

func supportAnswerAuthorName(item models.SupportAnswer) string {
	user := repositories.UserRepository.Get(sqls.DB(), item.AuthorID)
	if user == nil {
		return ""
	}
	if user.Nickname != "" {
		return user.Nickname
	}
	return user.Username
}
