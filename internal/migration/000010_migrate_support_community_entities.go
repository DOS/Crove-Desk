package migration

import (
	"agent-desk/internal/pkg/enums"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func init() {
	register(10, "migrate support community entities", func() error {
		return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
			if err := migrateSupportCategories(ctx.Tx); err != nil {
				return err
			}
			if err := migrateSupportPosts(ctx.Tx); err != nil {
				return err
			}
			if err := migrateSupportComments(ctx.Tx); err != nil {
				return err
			}
			if err := migrateSupportReactions(ctx.Tx); err != nil {
				return err
			}
			if err := migrateSupportCommentReports(ctx.Tx); err != nil {
				return err
			}
			return syncSupportCommunityPermissions(ctx.Tx)
		})
	})
}

func syncSupportCommunityPermissions(db *gorm.DB) error {
	permissions, err := ensurePermissions(db)
	if err != nil {
		return err
	}
	roles, err := ensureRoles(db)
	if err != nil {
		return err
	}
	return ensureRolePermissions(db, roles, permissions)
}

func migrateSupportCategories(db *gorm.DB) error {
	if !db.Migrator().HasTable("support_question_categories") {
		return nil
	}
	return db.Exec(`
		INSERT INTO support_categories (
			id, name, slug, description, sort_no, status, remark,
			created_at, create_user_id, create_user_name, updated_at, update_user_id, update_user_name
		)
		SELECT
			old.id, old.name, old.slug, old.description, old.sort_no, old.status, old.remark,
			old.created_at, old.create_user_id, old.create_user_name, old.updated_at, old.update_user_id, old.update_user_name
		FROM support_question_categories old
		WHERE NOT EXISTS (SELECT 1 FROM support_categories new WHERE new.id = old.id)
	`).Error
}

func migrateSupportPosts(db *gorm.DB) error {
	if !db.Migrator().HasTable("support_questions") {
		return nil
	}
	return db.Exec(`
		INSERT INTO support_posts (
			id, category_id, user_id, title, content_type, content, tags_json, status,
			accepted_comment_id, comment_count, reaction_count, view_count,
			last_commented_at, last_comment_user_type, last_comment_user_id,
			created_at, create_user_id, create_user_name, updated_at, update_user_id, update_user_name
		)
		SELECT
			old.id, old.category_id, old.user_id, old.title, old.content_type, old.content, old.tags_json, old.status,
			old.best_answer_id, old.answer_count, old.vote_count, old.view_count,
			old.last_answered_at, old.last_answer_user_type, old.last_answer_user_id,
			old.created_at, old.create_user_id, old.create_user_name, old.updated_at, old.update_user_id, old.update_user_name
		FROM support_questions old
		WHERE NOT EXISTS (SELECT 1 FROM support_posts new WHERE new.id = old.id)
	`).Error
}

func migrateSupportComments(db *gorm.DB) error {
	if !db.Migrator().HasTable("support_answers") {
		return nil
	}
	return db.Exec(`
		INSERT INTO support_comments (
			id, post_id, parent_id, author_type, author_id, content_type, content, status,
			reaction_count, reply_count, report_count, is_accepted,
			created_at, create_user_id, create_user_name, updated_at, update_user_id, update_user_name
		)
		SELECT
			old.id, old.question_id, old.parent_id, old.author_type, old.author_id, old.content_type, old.content, old.status,
			old.vote_count, old.reply_count, old.report_count, old.is_best_answer,
			old.created_at, old.create_user_id, old.create_user_name, old.updated_at, old.update_user_id, old.update_user_name
		FROM support_answers old
		WHERE NOT EXISTS (SELECT 1 FROM support_comments new WHERE new.id = old.id)
	`).Error
}

func migrateSupportReactions(db *gorm.DB) error {
	if db.Migrator().HasTable("support_question_votes") {
		if err := db.Exec(`
			INSERT INTO support_reactions (target_type, target_id, user_id, reaction_type, created_at, updated_at)
			SELECT ?, old.question_id, old.user_id, ?, old.created_at, old.updated_at
			FROM support_question_votes old
			WHERE NOT EXISTS (
				SELECT 1 FROM support_reactions new
				WHERE new.target_type = ? AND new.target_id = old.question_id AND new.user_id = old.user_id AND new.reaction_type = ?
			)
		`, string(enums.SupportReactionTargetPost), string(enums.SupportReactionTypeLike), string(enums.SupportReactionTargetPost), string(enums.SupportReactionTypeLike)).Error; err != nil {
			return err
		}
	}
	if db.Migrator().HasTable("support_answer_votes") {
		if err := db.Exec(`
			INSERT INTO support_reactions (target_type, target_id, user_id, reaction_type, created_at, updated_at)
			SELECT ?, old.answer_id, old.user_id, ?, old.created_at, old.updated_at
			FROM support_answer_votes old
			WHERE NOT EXISTS (
				SELECT 1 FROM support_reactions new
				WHERE new.target_type = ? AND new.target_id = old.answer_id AND new.user_id = old.user_id AND new.reaction_type = ?
			)
		`, string(enums.SupportReactionTargetComment), string(enums.SupportReactionTypeLike), string(enums.SupportReactionTargetComment), string(enums.SupportReactionTypeLike)).Error; err != nil {
			return err
		}
	}
	return nil
}

func migrateSupportCommentReports(db *gorm.DB) error {
	if !db.Migrator().HasTable("support_answer_reports") {
		return nil
	}
	return db.Exec(`
		INSERT INTO support_comment_reports (id, comment_id, user_id, reason, created_at)
		SELECT old.id, old.answer_id, old.user_id, old.reason, old.created_at
		FROM support_answer_reports old
		WHERE NOT EXISTS (SELECT 1 FROM support_comment_reports new WHERE new.id = old.id)
	`).Error
}
