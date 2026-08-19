package services

import (
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/config"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/dto/response"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/repositories"
	"encoding/json"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/sqls"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	supportUserContextKey = "supportUser"
)

var SupportService = &supportService{}

type supportService struct{}

func (s *supportService) RegisterUser(req request.SupportCustomerRegisterRequest, authCfg config.AuthConfig, clientIP, userAgent string) (*response.LoginResponse, error) {
	name := strings.TrimSpace(req.Name)
	email := normalizeSupportEmail(req.Email)
	password := strings.TrimSpace(req.Password)
	if name == "" || email == "" || len(password) < 8 {
		return nil, errorsx.InvalidParam("name, email and at least 8 characters password are required")
	}
	if repositories.UserRepository.GetByUsername(sqls.DB(), email) != nil || repositories.UserRepository.GetByEmail(sqls.DB(), email) != nil {
		return nil, errorsx.InvalidParam("email is already registered")
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	user := &models.User{
		Username:     email,
		Nickname:     name,
		Email:        &email,
		Password:     string(passwordHash),
		PasswordSalt: "",
		UserType:     enums.UserTypeUser,
		Status:       enums.StatusOk,
		AuditFields:  supportAuditFields(0, name, now),
	}
	if err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := repositories.UserRepository.Create(ctx.Tx, user); err != nil {
			return err
		}
		return repositories.CustomerRepository.Create(ctx.Tx, &models.Customer{
			UserID:       user.ID,
			Name:         name,
			PrimaryEmail: email,
			Status:       enums.StatusOk,
			AuditFields:  supportAuditFields(user.ID, name, now),
		})
	}); err != nil {
		return nil, err
	}
	return AuthService.Login(request.LoginRequest{Username: email, Password: password}, authCfg, clientIP, userAgent)
}

func (s *supportService) RequireSupportUser(ctx *gin.Context) (*dto.AuthPrincipal, error) {
	if principal := s.GetSupportUser(ctx); principal != nil {
		return principal, nil
	}
	principal, err := AuthService.Authenticate(ctx)
	if err != nil {
		return nil, err
	}
	ctx.Set(supportUserContextKey, principal)
	return principal, nil
}

func (s *supportService) GetSupportUser(ctx *gin.Context) *dto.AuthPrincipal {
	if ctx == nil {
		return nil
	}
	value, _ := ctx.Get(supportUserContextKey)
	if principal, ok := value.(*dto.AuthPrincipal); ok {
		return principal
	}
	return nil
}

func (s *supportService) validateHelpPageParent(id, parentID int64) error {
	if parentID == 0 {
		return nil
	}
	if id > 0 && id == parentID {
		return errorsx.InvalidParam("page cannot be its own parent")
	}
	parent := repositories.SupportHelpPageRepository.Get(sqls.DB(), parentID)
	if parent == nil {
		return errorsx.InvalidParam("parent page not found")
	}
	depth := 2
	visited := map[int64]bool{parentID: true}
	for parent.ParentID > 0 {
		if parent.ParentID == id || visited[parent.ParentID] {
			return errorsx.InvalidParam("page hierarchy contains a cycle")
		}
		visited[parent.ParentID] = true
		parent = repositories.SupportHelpPageRepository.Get(sqls.DB(), parent.ParentID)
		if parent == nil {
			return errorsx.InvalidParam("parent page not found")
		}
		depth++
		if depth > 4 {
			return errorsx.InvalidParam("page hierarchy supports at most four levels")
		}
	}
	return nil
}

func (s *supportService) SaveHelpPage(req request.SaveSupportHelpPageRequest, operator *dto.AuthPrincipal) (*models.SupportHelpPage, error) {
	title, slug := strings.TrimSpace(req.Title), normalizeSupportSlug(req.Slug)
	if title == "" || slug == "" {
		return nil, errorsx.InvalidParam("title and slug are required")
	}
	if err := s.validateHelpPageParent(req.ID, req.ParentID); err != nil {
		return nil, err
	}
	if existing := repositories.SupportHelpPageRepository.GetBySlug(sqls.DB(), slug); existing != nil && existing.ID != req.ID {
		return nil, errorsx.InvalidParam("page slug already exists")
	}
	status := normalizeHelpPageStatus(req.Status)
	if status == enums.SupportHelpPageStatusPublished && req.ParentID > 0 {
		parent := repositories.SupportHelpPageRepository.Get(sqls.DB(), req.ParentID)
		if parent == nil || parent.Status != enums.SupportHelpPageStatusPublished {
			return nil, errorsx.InvalidParam("publish the parent page first")
		}
	}
	if req.ID > 0 && status != enums.SupportHelpPageStatusPublished {
		publishedChildren := repositories.SupportHelpPageRepository.Find(sqls.DB(), sqls.NewCnd().Eq("parent_id", req.ID).Eq("status", enums.SupportHelpPageStatusPublished).Page(1, 1))
		if len(publishedChildren) > 0 {
			return nil, errorsx.InvalidParam("unpublish child pages first")
		}
	}
	tags, _ := json.Marshal(normalizeTags(req.Tags))
	now := time.Now()
	publishedAt := (*time.Time)(nil)
	if req.Status == enums.SupportHelpPageStatusPublished {
		publishedAt = &now
	}
	columns := map[string]any{"parent_id": req.ParentID, "title": title, "slug": slug, "summary": strings.TrimSpace(req.Summary), "content_type": normalizeContentType(req.ContentType), "content": req.Content, "cover_url": strings.TrimSpace(req.CoverURL), "tags_json": string(tags), "status": status, "sort_no": req.SortNo, "remark": strings.TrimSpace(req.Remark), "updated_at": now, "update_user_id": operator.UserID, "update_user_name": operator.Username}
	if publishedAt != nil {
		columns["published_at"] = publishedAt
	}
	if req.ID > 0 {
		if repositories.SupportHelpPageRepository.Get(sqls.DB(), req.ID) == nil {
			return nil, errorsx.InvalidParam("page not found")
		}
		if err := repositories.SupportHelpPageRepository.Updates(sqls.DB(), req.ID, columns); err != nil {
			return nil, err
		}
		return repositories.SupportHelpPageRepository.Get(sqls.DB(), req.ID), nil
	}
	item := &models.SupportHelpPage{ParentID: req.ParentID, Title: title, Slug: slug, Summary: strings.TrimSpace(req.Summary), ContentType: normalizeContentType(req.ContentType), Content: req.Content, CoverURL: strings.TrimSpace(req.CoverURL), TagsJSON: string(tags), Status: status, SortNo: req.SortNo, PublishedAt: publishedAt, Remark: strings.TrimSpace(req.Remark), AuditFields: auditFieldsFromOperator(operator, now)}
	if err := repositories.SupportHelpPageRepository.Create(sqls.DB(), item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *supportService) DeleteHelpPage(id int64) error {
	if repositories.SupportHelpPageRepository.Get(sqls.DB(), id) == nil {
		return errorsx.InvalidParam("page not found")
	}
	children := repositories.SupportHelpPageRepository.Find(sqls.DB(), sqls.NewCnd().Eq("parent_id", id).Page(1, 1))
	if len(children) > 0 {
		return errorsx.InvalidParam("page still has child pages")
	}
	return repositories.SupportHelpPageRepository.Delete(sqls.DB(), id)
}

func (s *supportService) SaveQuestionCategory(req request.SaveSupportQuestionCategoryRequest, operator *dto.AuthPrincipal) (*models.SupportQuestionCategory, error) {
	name, slug := strings.TrimSpace(req.Name), normalizeSupportSlug(req.Slug)
	if name == "" || slug == "" {
		return nil, errorsx.InvalidParam("name and slug are required")
	}
	now := time.Now()
	if req.ID > 0 {
		if repositories.SupportQuestionCategoryRepository.Get(sqls.DB(), req.ID) == nil {
			return nil, errorsx.InvalidParam("category not found")
		}
		if err := repositories.SupportQuestionCategoryRepository.Updates(sqls.DB(), req.ID, map[string]any{"name": name, "slug": slug, "description": strings.TrimSpace(req.Description), "sort_no": req.SortNo, "status": req.Status, "remark": strings.TrimSpace(req.Remark), "update_user_id": operator.UserID, "update_user_name": operator.Username, "updated_at": now}); err != nil {
			return nil, err
		}
		return repositories.SupportQuestionCategoryRepository.Get(sqls.DB(), req.ID), nil
	}
	item := &models.SupportQuestionCategory{Name: name, Slug: slug, Description: strings.TrimSpace(req.Description), SortNo: req.SortNo, Status: req.Status, Remark: strings.TrimSpace(req.Remark), AuditFields: auditFieldsFromOperator(operator, now)}
	if item.Status == 0 {
		item.Status = enums.StatusOk
	}
	if err := repositories.SupportQuestionCategoryRepository.Create(sqls.DB(), item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *supportService) DeleteQuestionCategory(id int64) error {
	if repositories.SupportQuestionCategoryRepository.Get(sqls.DB(), id) == nil {
		return errorsx.InvalidParam("category not found")
	}
	_, paging := repositories.SupportQuestionRepository.FindPageByCnd(
		sqls.DB(),
		sqls.NewCnd().Eq("category_id", id).Page(1, 1),
	)
	if paging.Total > 0 {
		return errorsx.InvalidParam("category is still used by questions")
	}
	return repositories.SupportQuestionCategoryRepository.Delete(sqls.DB(), id)
}

func (s *supportService) CreateQuestion(req request.CreateSupportQuestionRequest, principal *dto.AuthPrincipal) (*models.SupportQuestion, error) {
	title, content := strings.TrimSpace(req.Title), strings.TrimSpace(req.Content)
	if principal == nil || principal.UserID <= 0 {
		return nil, errorsx.Unauthorized("login is required")
	}
	if title == "" || content == "" {
		return nil, errorsx.InvalidParam("title and content are required")
	}
	tags, _ := json.Marshal(normalizeTags(req.Tags))
	now := time.Now()
	item := &models.SupportQuestion{CategoryID: req.CategoryID, UserID: principal.UserID, Title: title, Content: content, TagsJSON: string(tags), Status: enums.SupportQuestionStatusNormal, AuditFields: supportAuditFields(principal.UserID, supportPrincipalName(principal), now)}
	if err := repositories.SupportQuestionRepository.Create(sqls.DB(), item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *supportService) UpdateQuestion(req request.UpdateSupportQuestionRequest, principal *dto.AuthPrincipal) error {
	item := repositories.SupportQuestionRepository.Get(sqls.DB(), req.ID)
	if item == nil {
		return errorsx.InvalidParam("question not found")
	}
	if principal == nil || item.UserID != principal.UserID {
		return errorsx.Forbidden("only the question owner can update it")
	}
	if item.Status == enums.SupportQuestionStatusResolved || item.Status == enums.SupportQuestionStatusClosed {
		return errorsx.BusinessError(1, "resolved or closed question cannot be edited")
	}
	tags, _ := json.Marshal(normalizeTags(req.Tags))
	return repositories.SupportQuestionRepository.Updates(sqls.DB(), req.ID, map[string]any{"category_id": req.CategoryID, "title": strings.TrimSpace(req.Title), "content": strings.TrimSpace(req.Content), "tags_json": string(tags), "update_user_id": principal.UserID, "update_user_name": supportPrincipalName(principal), "updated_at": time.Now()})
}

func (s *supportService) CreateSupportUserAnswer(req request.CreateSupportAnswerRequest, principal *dto.AuthPrincipal) (*models.SupportAnswer, error) {
	if principal == nil {
		return nil, errorsx.Unauthorized("login is required")
	}
	return s.createAnswer(req.QuestionID, strings.TrimSpace(req.Content), supportAuthorType(principal), principal.UserID, supportPrincipalName(principal))
}

func (s *supportService) CreateUserAnswer(req request.CreateSupportAnswerRequest, operator *dto.AuthPrincipal) (*models.SupportAnswer, error) {
	if operator == nil {
		return nil, errorsx.Unauthorized("login is required")
	}
	return s.createAnswer(req.QuestionID, strings.TrimSpace(req.Content), supportAuthorType(operator), operator.UserID, supportPrincipalName(operator))
}

func (s *supportService) createAnswer(questionID int64, content string, authorType enums.SupportAnswerAuthorType, authorID int64, authorName string) (*models.SupportAnswer, error) {
	if content == "" {
		return nil, errorsx.InvalidParam("answer content is required")
	}
	question := repositories.SupportQuestionRepository.Get(sqls.DB(), questionID)
	if question == nil || question.Status == enums.SupportQuestionStatusDeleted || question.Status == enums.SupportQuestionStatusClosed {
		return nil, errorsx.InvalidParam("question is unavailable")
	}
	now := time.Now()
	answer := &models.SupportAnswer{QuestionID: questionID, AuthorType: authorType, AuthorID: authorID, Content: content, Status: enums.SupportAnswerStatusNormal, AuditFields: supportAuditFields(authorID, authorName, now)}
	if err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := repositories.SupportAnswerRepository.Create(ctx.Tx, answer); err != nil {
			return err
		}
		return repositories.SupportQuestionRepository.Updates(ctx.Tx, questionID, map[string]any{"answer_count": gorm.Expr("answer_count + ?", 1), "last_answered_at": now, "last_answer_user_type": authorType, "last_answer_user_id": authorID, "updated_at": now})
	}); err != nil {
		return nil, err
	}
	return answer, nil
}

func (s *supportService) AcceptAnswer(req request.SupportAcceptAnswerRequest, principal *dto.AuthPrincipal, operator *dto.AuthPrincipal) error {
	question := repositories.SupportQuestionRepository.Get(sqls.DB(), req.QuestionID)
	answer := repositories.SupportAnswerRepository.Get(sqls.DB(), req.AnswerID)
	if question == nil || answer == nil || answer.QuestionID != question.ID {
		return errorsx.InvalidParam("question or answer not found")
	}
	if operator == nil {
		if principal == nil || question.UserID != principal.UserID {
			return errorsx.Forbidden("only owner or admin can accept the best answer")
		}
	}
	now := time.Now()
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if err := ctx.Tx.Model(&models.SupportAnswer{}).Where("question_id = ?", question.ID).Update("is_best_answer", false).Error; err != nil {
			return err
		}
		if err := repositories.SupportAnswerRepository.Updates(ctx.Tx, answer.ID, map[string]any{"is_best_answer": true, "updated_at": now}); err != nil {
			return err
		}
		return repositories.SupportQuestionRepository.Updates(ctx.Tx, question.ID, map[string]any{"best_answer_id": answer.ID, "status": enums.SupportQuestionStatusResolved, "updated_at": now})
	})
}

func (s *supportService) ToggleQuestionVote(questionID int64, principal *dto.AuthPrincipal) error {
	if principal == nil {
		return errorsx.Unauthorized("login is required")
	}
	question := repositories.SupportQuestionRepository.Get(sqls.DB(), questionID)
	if question == nil {
		return errorsx.InvalidParam("question not found")
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		existing := repositories.SupportQuestionVoteRepository.Get(ctx.Tx, questionID, principal.UserID)
		delta := 1
		if existing != nil {
			delta = -1
			if err := repositories.SupportQuestionVoteRepository.Delete(ctx.Tx, questionID, principal.UserID); err != nil {
				return err
			}
		} else {
			now := time.Now()
			if err := repositories.SupportQuestionVoteRepository.Create(ctx.Tx, &models.SupportQuestionVote{QuestionID: questionID, UserID: principal.UserID, VoteValue: 1, CreatedAt: now, UpdatedAt: now}); err != nil {
				return err
			}
		}
		return repositories.SupportQuestionRepository.UpdateColumn(ctx.Tx, questionID, "vote_count", gorm.Expr("vote_count + ?", delta))
	})
}

func (s *supportService) ToggleAnswerVote(answerID int64, principal *dto.AuthPrincipal) error {
	if principal == nil {
		return errorsx.Unauthorized("login is required")
	}
	answer := repositories.SupportAnswerRepository.Get(sqls.DB(), answerID)
	if answer == nil {
		return errorsx.InvalidParam("answer not found")
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		existing := repositories.SupportAnswerVoteRepository.Get(ctx.Tx, answerID, principal.UserID)
		delta := 1
		if existing != nil {
			delta = -1
			if err := repositories.SupportAnswerVoteRepository.Delete(ctx.Tx, answerID, principal.UserID); err != nil {
				return err
			}
		} else {
			now := time.Now()
			if err := repositories.SupportAnswerVoteRepository.Create(ctx.Tx, &models.SupportAnswerVote{AnswerID: answerID, UserID: principal.UserID, VoteValue: 1, CreatedAt: now, UpdatedAt: now}); err != nil {
				return err
			}
		}
		return repositories.SupportAnswerRepository.Updates(ctx.Tx, answerID, map[string]any{"vote_count": gorm.Expr("vote_count + ?", delta), "updated_at": time.Now()})
	})
}

func (s *supportService) ModerateQuestion(req request.ModerateSupportQuestionRequest) error {
	if repositories.SupportQuestionRepository.Get(sqls.DB(), req.ID) == nil {
		return errorsx.InvalidParam("question not found")
	}
	return repositories.SupportQuestionRepository.Updates(sqls.DB(), req.ID, map[string]any{"status": req.Status, "updated_at": time.Now()})
}

func (s *supportService) ModerateAnswer(req request.ModerateSupportAnswerRequest) error {
	if repositories.SupportAnswerRepository.Get(sqls.DB(), req.ID) == nil {
		return errorsx.InvalidParam("answer not found")
	}
	return repositories.SupportAnswerRepository.Updates(sqls.DB(), req.ID, map[string]any{"status": req.Status, "updated_at": time.Now()})
}

func (s *supportService) FeedbackHelpPage(req request.SupportHelpPageFeedbackRequest) error {
	column := "unhelpful_count"
	if req.Helpful {
		column = "helpful_count"
	}
	return repositories.SupportHelpPageRepository.UpdateColumn(sqls.DB(), req.ID, column, gorm.Expr(column+" + ?", 1))
}

func normalizeSupportEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normalizeSupportSlug(slug string) string {
	return strings.ToLower(strings.TrimSpace(slug))
}

func normalizeContentType(contentType string) string {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	if contentType == "html" {
		return "html"
	}
	return "markdown"
}

func normalizeHelpPageStatus(status enums.SupportHelpPageStatus) enums.SupportHelpPageStatus {
	if status == "" {
		return enums.SupportHelpPageStatusDraft
	}
	return status
}

func normalizeTags(tags []string) []string {
	ret := make([]string, 0, len(tags))
	seen := map[string]struct{}{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		ret = append(ret, tag)
	}
	return ret
}

func auditFieldsFromOperator(operator *dto.AuthPrincipal, now time.Time) models.AuditFields {
	if operator == nil {
		return supportAuditFields(0, "system", now)
	}
	return supportAuditFields(operator.UserID, operator.Username, now)
}

func supportAuditFields(userID int64, username string, now time.Time) models.AuditFields {
	return models.AuditFields{CreatedAt: now, CreateUserID: userID, CreateUserName: username, UpdatedAt: now, UpdateUserID: userID, UpdateUserName: username}
}

func supportPrincipalName(principal *dto.AuthPrincipal) string {
	if principal == nil {
		return ""
	}
	if strings.TrimSpace(principal.Nickname) != "" {
		return strings.TrimSpace(principal.Nickname)
	}
	return strings.TrimSpace(principal.Username)
}

func supportAuthorType(principal *dto.AuthPrincipal) enums.SupportAnswerAuthorType {
	if principal != nil && principal.UserType == enums.UserTypeEmployee {
		return enums.SupportAnswerAuthorTypeEmployee
	}
	return enums.SupportAnswerAuthorTypeUser
}
