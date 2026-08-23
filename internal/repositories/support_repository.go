package repositories

import (
	"agent-desk/internal/models"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var (
	SupportHelpPageRepository = &supportHelpPageRepository{}
	CategoryRepository        = &supportCategoryRepository{}
	PostRepository            = &supportPostRepository{}
	CommentRepository         = &supportCommentRepository{}
	ReactionRepository        = &supportReactionRepository{}
	CommentReportRepository   = &supportCommentReportRepository{}
)

type supportHelpPageRepository struct{}

func (r *supportHelpPageRepository) Get(db *gorm.DB, id int64) *models.SupportHelpPage {
	ret := &models.SupportHelpPage{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportHelpPageRepository) GetByParentIDAndSlug(db *gorm.DB, parentID int64, slug string) *models.SupportHelpPage {
	ret := &models.SupportHelpPage{}
	if err := db.First(ret, "parent_id = ? AND slug = ?", parentID, slug).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportHelpPageRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportHelpPage) {
	cnd.Find(db, &list)
	return
}

// FindNavigationItems deliberately selects only fields required to render the
// public help navigation. Article content is fetched on demand by its detail API.
func (r *supportHelpPageRepository) FindNavigationItems(db *gorm.DB, cnd *sqls.Cnd) (list []models.SupportHelpPage) {
	cnd.Find(db.Select("id", "parent_id", "title", "slug", "sort_no"), &list)
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

type supportCategoryRepository struct{}

func (r *supportCategoryRepository) Get(db *gorm.DB, id int64) *models.Category {
	ret := &models.Category{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportCategoryRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.Category) {
	cnd.Find(db, &list)
	return
}

func (r *supportCategoryRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.Category, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.Category{})}
	return
}

func (r *supportCategoryRepository) Create(db *gorm.DB, item *models.Category) error {
	return db.Create(item).Error
}

func (r *supportCategoryRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.Category{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportCategoryRepository) UpdateColumn(db *gorm.DB, id int64, column string, value any) error {
	return db.Model(&models.Category{}).Where("id = ?", id).UpdateColumn(column, value).Error
}

func (r *supportCategoryRepository) Delete(db *gorm.DB, id int64) error {
	return db.Delete(&models.Category{}, "id = ?", id).Error
}

type supportPostRepository struct{}

func (r *supportPostRepository) Get(db *gorm.DB, id int64) *models.Post {
	ret := &models.Post{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportPostRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.Post) {
	cnd.Find(db, &list)
	return
}

func (r *supportPostRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.Post, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.Post{})}
	return
}

func (r *supportPostRepository) Create(db *gorm.DB, item *models.Post) error {
	return db.Create(item).Error
}

func (r *supportPostRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.Post{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportPostRepository) UpdateColumn(db *gorm.DB, id int64, column string, value any) error {
	return db.Model(&models.Post{}).Where("id = ?", id).UpdateColumn(column, value).Error
}

type supportCommentRepository struct{}

func (r *supportCommentRepository) Get(db *gorm.DB, id int64) *models.Comment {
	ret := &models.Comment{}
	if err := db.First(ret, "id = ?", id).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportCommentRepository) Find(db *gorm.DB, cnd *sqls.Cnd) (list []models.Comment) {
	cnd.Find(db, &list)
	return
}

func (r *supportCommentRepository) FindPageByCnd(db *gorm.DB, cnd *sqls.Cnd) (list []models.Comment, paging *sqls.Paging) {
	cnd.Find(db, &list)
	paging = &sqls.Paging{Page: cnd.Paging.Page, Limit: cnd.Paging.Limit, Total: cnd.Count(db, &models.Comment{})}
	return
}

func (r *supportCommentRepository) Create(db *gorm.DB, item *models.Comment) error {
	return db.Create(item).Error
}

func (r *supportCommentRepository) Updates(db *gorm.DB, id int64, columns map[string]any) error {
	return db.Model(&models.Comment{}).Where("id = ?", id).Updates(columns).Error
}

func (r *supportCommentRepository) UpdateColumn(db *gorm.DB, id int64, column string, value any) error {
	return db.Model(&models.Comment{}).Where("id = ?", id).UpdateColumn(column, value).Error
}

type supportReactionRepository struct{}

func (r *supportReactionRepository) Get(db *gorm.DB, targetType string, targetID, userID int64, reactionType string) *models.Reaction {
	ret := &models.Reaction{}
	if err := db.First(ret, "target_type = ? AND target_id = ? AND user_id = ? AND reaction_type = ?", targetType, targetID, userID, reactionType).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportReactionRepository) Create(db *gorm.DB, item *models.Reaction) error {
	return db.Create(item).Error
}

func (r *supportReactionRepository) Delete(db *gorm.DB, targetType string, targetID, userID int64, reactionType string) error {
	return db.Delete(&models.Reaction{}, "target_type = ? AND target_id = ? AND user_id = ? AND reaction_type = ?", targetType, targetID, userID, reactionType).Error
}

type supportCommentReportRepository struct{}

func (r *supportCommentReportRepository) Get(db *gorm.DB, commentID, userID int64) *models.CommentReport {
	ret := &models.CommentReport{}
	if err := db.First(ret, "comment_id = ? AND user_id = ?", commentID, userID).Error; err != nil {
		return nil
	}
	return ret
}

func (r *supportCommentReportRepository) Create(db *gorm.DB, item *models.CommentReport) error {
	return db.Create(item).Error
}
