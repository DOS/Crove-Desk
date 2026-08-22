//go:build dev

package webspa

import (
	"io/fs"
	"os"
)

var SPA fs.FS = getDevFS()

func getDevFS() fs.FS {
	for _, dir := range []string{"web", "../web", "../../web", "../../../web"} {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			return os.DirFS(dir)
		}
	}
	return os.DirFS("web")
}
