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
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/mlogclub/simple/sqls"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	supportCustomerContextKey = "supportCustomer"
	supportCustomerTokenType  = "support_customer"
)

var SupportService = &supportService{}

type supportService struct{}

type supportCustomerClaims struct {
	TokenType  string `json:"typ"`
	CustomerID int64  `json:"customerId"`
	Email      string `json:"email"`
	jwt.RegisteredClaims
}

func (s *supportService) RegisterCustomer(req request.SupportCustomerRegisterRequest, clientIP string) (*response.SupportCustomerLoginResponse, error) {
	name := strings.TrimSpace(req.Name)
	email := normalizeSupportEmail(req.Email)
	password := strings.TrimSpace(req.Password)
	if name == "" || email == "" || len(password) < 8 {
		return nil, errorsx.InvalidParam("name, email and at least 8 characters password are required")
	}
	if repositories.CustomerSupportAccountRepository.GetByEmail(sqls.DB(), email) != nil {
		return nil, errorsx.InvalidParam("email is already registered")
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var customer *models.Customer
	var account *models.CustomerSupportAccount
	if err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		customer = &models.Customer{
			Name:         name,
			PrimaryEmail: email,
			Status:       enums.StatusOk,
			AuditFields:  supportAuditFields(0, name, now),
		}
		if err := repositories.CustomerRepository.Create(ctx.Tx, customer); err != nil {
			return err
		}
		account = &models.CustomerSupportAccount{
			CustomerID:   customer.ID,
			Email:        email,
			PasswordHash: string(passwordHash),
			Status:       enums.StatusOk,
			LastLoginAt:  &now,
			LastLoginIP:  clientIP,
			AuditFields:  supportAuditFields(customer.ID, name, now),
		}
		return repositories.CustomerSupportAccountRepository.Create(ctx.Tx, account)
	}); err != nil {
		return nil, err
	}
	return s.issueCustomerToken(customer, account)
}

func (s *supportService) LoginCustomer(req request.SupportCustomerLoginRequest, clientIP string) (*response.SupportCustomerLoginResponse, error) {
	email := normalizeSupportEmail(req.Email)
	password := strings.TrimSpace(req.Password)
	if email == "" || password == "" {
		return nil, errorsx.InvalidParam("email and password are required")
	}
	account := repositories.CustomerSupportAccountRepository.GetByEmail(sqls.DB(), email)
	if account == nil || account.Status != enums.StatusOk || bcrypt.CompareHashAndPassword([]byte(account.PasswordHash), []byte(password)) != nil {
		return nil, errorsx.InvalidAccount("invalid email or password")
	}
	customer := repositories.CustomerRepository.Get(sqls.DB(), account.CustomerID)
	if customer == nil || customer.Status == enums.StatusDeleted {
		return nil, errorsx.InvalidAccount("customer account is unavailable")
	}
	now := time.Now()
	_ = repositories.CustomerSupportAccountRepository.Updates(sqls.DB(), account.ID, map[string]any{
		"last_login_at": now,
		"last_login_ip": clientIP,
		"updated_at":    now,
	})
	return s.issueCustomerToken(customer, account)
}

func (s *supportService) RequireCustomer(ctx *gin.Context) (*dto.SupportCustomerPrincipal, error) {
	if principal := s.GetCustomer(ctx); principal != nil {
		return principal, nil
	}
	token := extractSupportBearer(ctx.GetHeader("Authorization"))
	if token == "" {
		return nil, errorsx.Unauthorized("login is required")
	}
	claims, err := s.verifyCustomerToken(token)
	if err != nil {
		return nil, err
	}
	account := repositories.CustomerSupportAccountRepository.GetByCustomerID(sqls.DB(), claims.CustomerID)
	if account == nil || account.Status != enums.StatusOk || account.Email != claims.Email {
		return nil, errorsx.Unauthorized("invalid support token")
	}
	customer := repositories.CustomerRepository.Get(sqls.DB(), claims.CustomerID)
	if customer == nil || customer.Status == enums.StatusDeleted {
		return nil, errorsx.Unauthorized("invalid support token")
	}
	principal := &dto.SupportCustomerPrincipal{
		CustomerID: customer.ID,
		Name:       strings.TrimSpace(customer.Name),
		Email:      account.Email,
		Status:     customer.Status,
	}
	ctx.Set(supportCustomerContextKey, principal)
	return principal, nil
}

func (s *supportService) GetCustomer(ctx *gin.Context) *dto.SupportCustomerPrincipal {
	if ctx == nil {
		return nil
	}
	value, _ := ctx.Get(supportCustomerContextKey)
	if principal, ok := value.(*dto.SupportCustomerPrincipal); ok {
		return principal
	}
	return nil
}

func (s *supportService) issueCustomerToken(customer *models.Customer, account *models.CustomerSupportAccount) (*response.SupportCustomerLoginResponse, error) {
	secret := supportTokenSecret()
	if secret == "" {
		return nil, errorsx.BusinessError(1, "customer session secret is missing")
	}
	now := time.Now()
	expiresAt := now.Add(30 * 24 * time.Hour)
	claims := supportCustomerClaims{
		TokenType:  supportCustomerTokenType,
		CustomerID: customer.ID,
		Email:      account.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		return nil, err
	}
	return &response.SupportCustomerLoginResponse{
		AccessToken: token,
		ExpiresAt:   expiresAt.Format(time.DateTime),
		Customer: response.SupportCustomerResponse{
			ID:    customer.ID,
			Name:  strings.TrimSpace(customer.Name),
			Email: account.Email,
		},
	}, nil
}

func (s *supportService) verifyCustomerToken(rawToken string) (*supportCustomerClaims, error) {
	claims := &supportCustomerClaims{}
	token, err := jwt.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unsupported signing method")
		}
		return []byte(supportTokenSecret()), nil
	}, jwt.WithExpirationRequired(), jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil || token == nil || !token.Valid || claims.TokenType != supportCustomerTokenType || claims.CustomerID <= 0 || claims.Email == "" {
		return nil, errorsx.Unauthorized("invalid support token")
	}
	return claims, nil
}

func (s *supportService) SaveArticleCategory(req request.SaveSupportArticleCategoryRequest, operator *dto.AuthPrincipal) (*models.SupportArticleCategory, error) {
	name, slug := strings.TrimSpace(req.Name), normalizeSupportSlug(req.Slug)
	if name == "" || slug == "" {
		return nil, errorsx.InvalidParam("name and slug are required")
	}
	now := time.Now()
	if req.ID > 0 {
		item := repositories.SupportArticleCategoryRepository.Get(sqls.DB(), req.ID)
		if item == nil {
			return nil, errorsx.InvalidParam("category not found")
		}
		if err := repositories.SupportArticleCategoryRepository.Updates(sqls.DB(), req.ID, map[string]any{
			"name": name, "slug": slug, "description": strings.TrimSpace(req.Description), "parent_id": req.ParentID,
			"sort_no": req.SortNo, "status": req.Status, "remark": strings.TrimSpace(req.Remark),
			"update_user_id": operator.UserID, "update_user_name": operator.Username, "updated_at": now,
		}); err != nil {
			return nil, err
		}
		return repositories.SupportArticleCategoryRepository.Get(sqls.DB(), req.ID), nil
	}
	item := &models.SupportArticleCategory{Name: name, Slug: slug, Description: strings.TrimSpace(req.Description), ParentID: req.ParentID, SortNo: req.SortNo, Status: req.Status, Remark: strings.TrimSpace(req.Remark), AuditFields: auditFieldsFromOperator(operator, now)}
	if item.Status == 0 {
		item.Status = enums.StatusOk
	}
	if err := repositories.SupportArticleCategoryRepository.Create(sqls.DB(), item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *supportService) SaveArticle(req request.SaveSupportArticleRequest, operator *dto.AuthPrincipal) (*models.SupportArticle, error) {
	title, slug := strings.TrimSpace(req.Title), normalizeSupportSlug(req.Slug)
	if title == "" || slug == "" {
		return nil, errorsx.InvalidParam("title and slug are required")
	}
	tags, _ := json.Marshal(normalizeTags(req.Tags))
	now := time.Now()
	publishedAt := (*time.Time)(nil)
	if req.Status == enums.SupportArticleStatusPublished {
		publishedAt = &now
	}
	columns := map[string]any{"category_id": req.CategoryID, "title": title, "slug": slug, "summary": strings.TrimSpace(req.Summary), "content_type": normalizeContentType(req.ContentType), "content": req.Content, "cover_url": strings.TrimSpace(req.CoverURL), "tags_json": string(tags), "status": normalizeArticleStatus(req.Status), "sort_no": req.SortNo, "remark": strings.TrimSpace(req.Remark), "updated_at": now, "update_user_id": operator.UserID, "update_user_name": operator.Username}
	if publishedAt != nil {
		columns["published_at"] = publishedAt
	}
	if req.ID > 0 {
		if repositories.SupportArticleRepository.Get(sqls.DB(), req.ID) == nil {
			return nil, errorsx.InvalidParam("article not found")
		}
		if err := repositories.SupportArticleRepository.Updates(sqls.DB(), req.ID, columns); err != nil {
			return nil, err
		}
		return repositories.SupportArticleRepository.Get(sqls.DB(), req.ID), nil
	}
	item := &models.SupportArticle{CategoryID: req.CategoryID, Title: title, Slug: slug, Summary: strings.TrimSpace(req.Summary), ContentType: normalizeContentType(req.ContentType), Content: req.Content, CoverURL: strings.TrimSpace(req.CoverURL), TagsJSON: string(tags), Status: normalizeArticleStatus(req.Status), SortNo: req.SortNo, PublishedAt: publishedAt, Remark: strings.TrimSpace(req.Remark), AuditFields: auditFieldsFromOperator(operator, now)}
	if err := repositories.SupportArticleRepository.Create(sqls.DB(), item); err != nil {
		return nil, err
	}
	return item, nil
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

func (s *supportService) CreateQuestion(req request.CreateSupportQuestionRequest, principal *dto.SupportCustomerPrincipal) (*models.SupportQuestion, error) {
	title, content := strings.TrimSpace(req.Title), strings.TrimSpace(req.Content)
	if principal == nil || principal.CustomerID <= 0 {
		return nil, errorsx.Unauthorized("login is required")
	}
	if title == "" || content == "" {
		return nil, errorsx.InvalidParam("title and content are required")
	}
	tags, _ := json.Marshal(normalizeTags(req.Tags))
	now := time.Now()
	item := &models.SupportQuestion{CategoryID: req.CategoryID, CustomerID: principal.CustomerID, Title: title, Content: content, TagsJSON: string(tags), Status: enums.SupportQuestionStatusNormal, AuditFields: supportAuditFields(principal.CustomerID, principal.Name, now)}
	if err := repositories.SupportQuestionRepository.Create(sqls.DB(), item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *supportService) UpdateQuestion(req request.UpdateSupportQuestionRequest, principal *dto.SupportCustomerPrincipal) error {
	item := repositories.SupportQuestionRepository.Get(sqls.DB(), req.ID)
	if item == nil {
		return errorsx.InvalidParam("question not found")
	}
	if principal == nil || item.CustomerID != principal.CustomerID {
		return errorsx.Forbidden("only the question owner can update it")
	}
	if item.Status == enums.SupportQuestionStatusResolved || item.Status == enums.SupportQuestionStatusClosed {
		return errorsx.BusinessError(1, "resolved or closed question cannot be edited")
	}
	tags, _ := json.Marshal(normalizeTags(req.Tags))
	return repositories.SupportQuestionRepository.Updates(sqls.DB(), req.ID, map[string]any{"category_id": req.CategoryID, "title": strings.TrimSpace(req.Title), "content": strings.TrimSpace(req.Content), "tags_json": string(tags), "update_user_id": principal.CustomerID, "update_user_name": principal.Name, "updated_at": time.Now()})
}

func (s *supportService) CreateCustomerAnswer(req request.CreateSupportAnswerRequest, principal *dto.SupportCustomerPrincipal) (*models.SupportAnswer, error) {
	if principal == nil {
		return nil, errorsx.Unauthorized("login is required")
	}
	return s.createAnswer(req.QuestionID, strings.TrimSpace(req.Content), enums.SupportAnswerAuthorTypeCustomer, principal.CustomerID, principal.Name)
}

func (s *supportService) CreateUserAnswer(req request.CreateSupportAnswerRequest, operator *dto.AuthPrincipal) (*models.SupportAnswer, error) {
	if operator == nil {
		return nil, errorsx.Unauthorized("login is required")
	}
	return s.createAnswer(req.QuestionID, strings.TrimSpace(req.Content), enums.SupportAnswerAuthorTypeUser, operator.UserID, operator.Username)
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

func (s *supportService) AcceptAnswer(req request.SupportAcceptAnswerRequest, principal *dto.SupportCustomerPrincipal, operator *dto.AuthPrincipal) error {
	question := repositories.SupportQuestionRepository.Get(sqls.DB(), req.QuestionID)
	answer := repositories.SupportAnswerRepository.Get(sqls.DB(), req.AnswerID)
	if question == nil || answer == nil || answer.QuestionID != question.ID {
		return errorsx.InvalidParam("question or answer not found")
	}
	if operator == nil {
		if principal == nil || question.CustomerID != principal.CustomerID {
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

func (s *supportService) ToggleQuestionVote(questionID int64, principal *dto.SupportCustomerPrincipal) error {
	if principal == nil {
		return errorsx.Unauthorized("login is required")
	}
	question := repositories.SupportQuestionRepository.Get(sqls.DB(), questionID)
	if question == nil {
		return errorsx.InvalidParam("question not found")
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		existing := repositories.SupportQuestionVoteRepository.Get(ctx.Tx, questionID, principal.CustomerID)
		delta := 1
		if existing != nil {
			delta = -1
			if err := repositories.SupportQuestionVoteRepository.Delete(ctx.Tx, questionID, principal.CustomerID); err != nil {
				return err
			}
		} else {
			now := time.Now()
			if err := repositories.SupportQuestionVoteRepository.Create(ctx.Tx, &models.SupportQuestionVote{QuestionID: questionID, CustomerID: principal.CustomerID, VoteValue: 1, CreatedAt: now, UpdatedAt: now}); err != nil {
				return err
			}
		}
		return repositories.SupportQuestionRepository.UpdateColumn(ctx.Tx, questionID, "vote_count", gorm.Expr("vote_count + ?", delta))
	})
}

func (s *supportService) ToggleAnswerVote(answerID int64, principal *dto.SupportCustomerPrincipal) error {
	if principal == nil {
		return errorsx.Unauthorized("login is required")
	}
	answer := repositories.SupportAnswerRepository.Get(sqls.DB(), answerID)
	if answer == nil {
		return errorsx.InvalidParam("answer not found")
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		existing := repositories.SupportAnswerVoteRepository.Get(ctx.Tx, answerID, principal.CustomerID)
		delta := 1
		if existing != nil {
			delta = -1
			if err := repositories.SupportAnswerVoteRepository.Delete(ctx.Tx, answerID, principal.CustomerID); err != nil {
				return err
			}
		} else {
			now := time.Now()
			if err := repositories.SupportAnswerVoteRepository.Create(ctx.Tx, &models.SupportAnswerVote{AnswerID: answerID, CustomerID: principal.CustomerID, VoteValue: 1, CreatedAt: now, UpdatedAt: now}); err != nil {
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

func (s *supportService) FeedbackArticle(req request.SupportArticleFeedbackRequest) error {
	column := "unhelpful_count"
	if req.Helpful {
		column = "helpful_count"
	}
	return repositories.SupportArticleRepository.UpdateColumn(sqls.DB(), req.ID, column, gorm.Expr(column+" + ?", 1))
}

func supportTokenSecret() string {
	return strings.TrimSpace(config.Current().CustomerSession.Secret)
}

func extractSupportBearer(auth string) string {
	auth = strings.TrimSpace(auth)
	if len(auth) > 7 && strings.EqualFold(auth[:7], "Bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
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

func normalizeArticleStatus(status enums.SupportArticleStatus) enums.SupportArticleStatus {
	if status == "" {
		return enums.SupportArticleStatusDraft
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
