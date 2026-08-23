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

func SupportCategoryAnyList(ctx *gin.Context) {
	list := repositories.SupportCategoryRepository.Find(sqls.DB(), sqls.NewCnd().Eq("status", enums.StatusOk).Asc("sort_no").Desc("id"))
	httpx.WriteJSON(ctx, builders.BuildSupportPostCategories(list))
}

func SupportPostAnyList(ctx *gin.Context) {
	cnd := params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "categoryId"},
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Where("status NOT IN ?", []enums.SupportPostStatus{enums.SupportPostStatusHidden, enums.SupportPostStatusDeleted}).Desc("id")
	list, paging := repositories.SupportPostRepository.FindPageByCnd(sqls.DB(), cnd)
	results := buildSupportPostList(list)
	httpx.WriteJSON(ctx, &web.PageResult{Results: results, Page: paging})
}

func SupportPostGetBy(ctx *gin.Context) {
	id, ok := httpx.GetPathInt64(ctx, "id")
	if !ok {
		return
	}
	post := repositories.SupportPostRepository.Get(sqls.DB(), id)
	if post == nil || post.Status == enums.SupportPostStatusHidden || post.Status == enums.SupportPostStatusDeleted {
		httpx.WriteJSON(ctx, httpx.JsonErrorMsg(ctx, "error.notFound"))
		return
	}
	_ = repositories.SupportPostRepository.UpdateColumn(sqls.DB(), post.ID, "view_count", gorm.Expr("view_count + ?", 1))
	comments, err := services.SupportService.ListPostComments(id, 0, "default", 1, 20)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, response.SupportPostDetailResponse{Post: *builders.BuildSupportPost(post, supportCategoryName(post.CategoryID), supportUser(post.UserID)), Comments: buildSupportCommentListWithReplies(comments.Comments, comments.Replies)})
}

func SupportPostPostCreate(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateSupportPostRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.CreatePost(req, principal)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportPost(item, supportCategoryName(item.CategoryID), supportUser(principal.UserID)))
}

func SupportPostPostUpdate(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.UpdateSupportPostRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.UpdatePost(req, principal))
}

func SupportPostPostAcceptComment(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportAcceptCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.AcceptComment(req, principal, nil))
}

func SupportCommentPostCreate(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateSupportCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.SupportService.CreateSupportUserComment(req, principal)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, builders.BuildSupportComment(item, supportPrincipalDisplayName(principal.UserID)))
}

func SupportCommentAnyList(ctx *gin.Context) {
	postID, _ := params.GetInt64(ctx, "postId")
	parentID, _ := params.GetInt64(ctx, "parentId")
	page, _ := params.GetInt(ctx, "page")
	limit, _ := params.GetInt(ctx, "limit")
	sort, _ := params.Get(ctx, "sort")
	result, err := services.SupportService.ListPostComments(postID, parentID, sort, page, limit)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, &web.PageResult{Results: buildSupportCommentListWithReplies(result.Comments, result.Replies), Page: result.Paging})
}

func SupportCommentPostUpdate(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.UpdateSupportCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.UpdateComment(req, principal))
}

func SupportCommentPostDelete(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportIDRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.DeleteComment(req.ID, principal))
}

func SupportCommentPostReport(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.ReportSupportCommentRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ReportComment(req, principal))
}

func SupportReactionPostToggle(ctx *gin.Context) {
	principal, err := services.SupportService.RequireSupportUser(ctx)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.SupportReactionRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, services.SupportService.ToggleReaction(req.TargetType, req.TargetID, req.ReactionType, principal))
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

func buildSupportPostList(list []models.SupportPost) []response.SupportPostResponse {
	results := make([]response.SupportPostResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportPost(&item, supportCategoryName(item.CategoryID), supportUser(item.UserID)); resp != nil {
			results = append(results, *resp)
		}
	}
	return results
}

func buildSupportCommentList(list []models.SupportComment) []response.SupportCommentResponse {
	return buildSupportCommentListWithReplies(list, nil)
}

func buildSupportCommentListWithReplies(list []models.SupportComment, replies map[int64][]models.SupportComment) []response.SupportCommentResponse {
	results := make([]response.SupportCommentResponse, 0, len(list))
	for _, item := range list {
		if resp := builders.BuildSupportComment(&item, supportCommentAuthorName(item)); resp != nil {
			if len(replies[item.ID]) > 0 {
				resp.Replies = buildSupportCommentListWithReplies(replies[item.ID], nil)
			}
			results = append(results, *resp)
		}
	}
	return results
}

func supportCategoryName(id int64) string {
	item := repositories.SupportCategoryRepository.Get(sqls.DB(), id)
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

func supportCommentAuthorName(item models.SupportComment) string {
	user := repositories.UserRepository.Get(sqls.DB(), item.AuthorID)
	if user == nil {
		return ""
	}
	if user.Nickname != "" {
		return user.Nickname
	}
	return user.Username
}
