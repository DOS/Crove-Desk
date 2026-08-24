package migration

import (
	"agent-desk/internal/models"

	"github.com/mlogclub/simple/sqls"
)

func init() {
	register(10, "system config group key unique index", func() error {
		migrator := sqls.DB().Migrator()

		for _, indexName := range []string{
			"idx_t_system_config_config_key",
			"idx_system_config_config_key",
			"uni_t_system_config_config_key",
			"uni_system_config_config_key",
		} {
			if migrator.HasIndex(&models.SystemConfig{}, indexName) {
				if err := migrator.DropIndex(&models.SystemConfig{}, indexName); err != nil {
					return err
				}
			}
		}

		if !migrator.HasIndex(&models.SystemConfig{}, "uk_system_config_group_key") {
			return migrator.CreateIndex(&models.SystemConfig{}, "uk_system_config_group_key")
		}
		return nil
	})
}
