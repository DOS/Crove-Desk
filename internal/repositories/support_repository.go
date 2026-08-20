package repositories

import (
	"agent-desk/internal/models"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var (
	SupportHelpPageRepository         = &supportHelpPageRepository{}
	SupportQuestionCategoryRepository = &supportQuestionCategoryRepository{}
	SupportQuestionRepository         = &supportQuestionRepository{}
	SupportAnswerRepository           = &supportAnswerRepository{}
	SupportQuestionVoteRepository     = &supportQuestionVoteRepository{}
	SupportAnswerVoteRepository       = &supportAnswerVoteRepository{}
)

type supportHelpPageRepository struct{}

func (r *supportHelpPageRepository) Get(db *gorm.DB, id int64) *models.SupportHelpPage {
	ret := &models.SupportHelpPage{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportHelpPageRepository) GetBySlug(db *gorm.DB, slug string) *models.SupportHelpPage {
	ret := &models.SupportHelpPage{}
	if err := db.First(ret, "slug = ?", slug).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportHelpPageRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportHelpPage) {
	cnd.Find(db, &list)
	return
}

func (r *supportHelpPageRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportHelpPage, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.SupportHelpPage{})}
	return
}

func (r *supportHelpPageRepository) Create(db *gorm.DB, item *models.SupportHelpPage) error {
	return db.Create(item).Error
}

func (r *supportHelpPageRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.SupportHelpPage{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportHelpPageRepository) UpdateColumn(db *gorm.DB, id int64, column string, value any) error {
	return db.Model(&models.SupportHelpPage{}).Where("id = ?", id).UpdateColumn(column, value).Error
}

func (r *supportHelpPageRepository) UpdateSort(db *gorm.DB, id int64, sortNo int) error {
	return db.Model(&models.SupportHelpPage{}).Where("id = ?", id).UpdateColumn("sort_no", sortNo).Error
}

func (r *supportHelpPageRepository) Delete(db *gorm.DB, id int64) error {
	return db.Delete(&models.SupportHelpPage{}, "id = ?", id).Error
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
