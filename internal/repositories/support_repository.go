package repositories

import (
	"agent-desk/internal/models"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var (
	SupportArticleCategoryRepository  = &supportArticleCategoryRepository{}
	SupportArticleRepository          = &supportArticleRepository{}
	SupportQuestionCategoryRepository = &supportQuestionCategoryRepository{}
	SupportQuestionRepository         = &supportQuestionRepository{}
	SupportAnswerRepository           = &supportAnswerRepository{}
	SupportQuestionVoteRepository     = &supportQuestionVoteRepository{}
	SupportAnswerVoteRepository       = &supportAnswerVoteRepository{}
)

type supportArticleCategoryRepository struct{}

func (r *supportArticleCategoryRepository) Get(db *gorm.DB, id int64) *models.SupportArticleCategory {
	ret := &models.SupportArticleCategory{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportArticleCategoryRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportArticleCategory) {
	cnd.Find(db, &list)
	return
}

func (r *supportArticleCategoryRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportArticleCategory, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.SupportArticleCategory{})}
	return
}

func (r *supportArticleCategoryRepository) Create(db *gorm.DB, item *models.SupportArticleCategory) error {
	return db.Create(item).Error
}

func (r *supportArticleCategoryRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.SupportArticleCategory{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportArticleCategoryRepository) Delete(db *gorm.DB, id int64) error {
	return db.Delete(&models.SupportArticleCategory{}, "id = ?", id).Error
}

type supportArticleRepository struct{}

func (r *supportArticleRepository) Get(db *gorm.DB, id int64) *models.SupportArticle {
	ret := &models.SupportArticle{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportArticleRepository) GetBySlug(db *gorm.DB, slug string) *models.SupportArticle {
	ret := &models.SupportArticle{}
	if err := db.First(ret, "slug = ?", slug).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportArticleRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportArticle) {
	cnd.Find(db, &list)
	return
}

func (r *supportArticleRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportArticle, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.SupportArticle{})}
	return
}

func (r *supportArticleRepository) Create(db *gorm.DB, item *models.SupportArticle) error {
	return db.Create(item).Error
}

func (r *supportArticleRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.SupportArticle{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportArticleRepository) UpdateColumn(db *gorm.DB, id int64, column string, value any) error {
	return db.Model(&models.SupportArticle{}).Where("id = ?", id).UpdateColumn(column, value).Error
}

func (r *supportArticleRepository) Delete(db *gorm.DB, id int64) error {
	return db.Delete(&models.SupportArticle{}, "id = ?", id).Error
}

type supportQuestionCategoryRepository struct{}

func (r *supportQuestionCategoryRepository) Get(db *gorm.DB, id int64) *models.SupportQuestionCategory {
	ret := &models.SupportQuestionCategory{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportQuestionCategoryRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportQuestionCategory) {
	cnd.Find(db, &list)
	return
}

func (r *supportQuestionCategoryRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportQuestionCategory, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.SupportQuestionCategory{})}
	return
}

func (r *supportQuestionCategoryRepository) Create(db *gorm.DB, item *models.SupportQuestionCategory) error {
	return db.Create(item).Error
}

func (r *supportQuestionCategoryRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.SupportQuestionCategory{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportQuestionCategoryRepository) Delete(db *gorm.DB, id int64) error {
	return db.Delete(&models.SupportQuestionCategory{}, "id = ?", id).Error
}

type supportQuestionRepository struct{}

func (r *supportQuestionRepository) Get(db *gorm.DB, id int64) *models.SupportQuestion {
	ret := &models.SupportQuestion{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportQuestionRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportQuestion, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.SupportQuestion{})}
	return
}

func (r *supportQuestionRepository) Create(db *gorm.DB, item *models.SupportQuestion) error {
	return db.Create(item).Error
}

func (r *supportQuestionRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.SupportQuestion{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportQuestionRepository) UpdateColumn(db *gorm.DB, id int64, column string, value any) error {
	return db.Model(&models.SupportQuestion{}).Where("id = ?", id).UpdateColumn(column, value).Error
}

type supportAnswerRepository struct{}

func (r *supportAnswerRepository) Get(db *gorm.DB, id int64) *models.SupportAnswer {
	ret := &models.SupportAnswer{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportAnswerRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportAnswer) {
	cnd.Find(db, &list)
	return
}

func (r *supportAnswerRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportAnswer, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.SupportAnswer{})}
	return
}

func (r *supportAnswerRepository) Create(db *gorm.DB, item *models.SupportAnswer) error {
	return db.Create(item).Error
}

func (r *supportAnswerRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.SupportAnswer{}).Where("id = ?", id).Updates(columns).Error
}

type supportQuestionVoteRepository struct{}

func (r *supportQuestionVoteRepository) Get(db *gorm.DB, questionID, userID int64) *models.SupportQuestionVote {
	ret := &models.SupportQuestionVote{}
	if err := db.First(ret, "question_id = ? AND user_id = ?", questionID, userID).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportQuestionVoteRepository) Create(db *gorm.DB, item *models.SupportQuestionVote) error {
	return db.Create(item).Error
}

func (r *supportQuestionVoteRepository) Delete(db *gorm.DB, questionID, userID int64) error {
	return db.Delete(&models.SupportQuestionVote{}, "question_id = ? AND user_id = ?", questionID, userID).Error
}

type supportAnswerVoteRepository struct{}

func (r *supportAnswerVoteRepository) Get(db *gorm.DB, answerID, userID int64) *models.SupportAnswerVote {
	ret := &models.SupportAnswerVote{}
	if err := db.First(ret, "answer_id = ? AND user_id = ?", answerID, userID).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportAnswerVoteRepository) Create(db *gorm.DB, item *models.SupportAnswerVote) error {
	return db.Create(item).Error
}

func (r *supportAnswerVoteRepository) Delete(db *gorm.DB, answerID, userID int64) error {
	return db.Delete(&models.SupportAnswerVote{}, "answer_id = ? AND user_id = ?", answerID, userID).Error
}
