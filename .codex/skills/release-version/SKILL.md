---
name: release-version
description: Use when preparing or publishing a new release of this fork, updating CHANGELOG.md, reconciling dev with main, creating Git tags, or publishing the GitHub Release page for DOS/Crove-Desk.
---

# Release Version

## Overview

Create a release with a `vX.Y.Z-crove.N` tag, derive the changelog entry from the
real Git range, reconcile `dev` with `main` before tagging, and publish the GitHub
Release page. Pushing the tag is what builds the production image.

Run the workflow from the repository root. Read
[references/changelog-style.md](references/changelog-style.md) before drafting the
notes.

This skill was inherited from upstream `huabeitech/agent-desk` and has been
rewritten for the fork. Three things it used to say are no longer true here: the
`docs` submodule was removed (upstream PR #35) so there is no bilingual docs
changelog, there is no Gitee mirror, and the release repository is
`DOS/Crove-Desk` rather than `huabeitech/agent-desk`.

## Workflow

1. Validate the requested version.
2. Reconcile `dev` and `main`.
3. Inspect the repository and determine the comparison range.
4. Draft the `CHANGELOG.md` entry from the actual diff.
5. Run the verification suite.
6. Commit and push the changelog.
7. Create and push the annotated tag.
8. Create the GitHub Release page for the tag.
9. Verify the production image build and the remote tag.

Do not skip the repository inspection step. Release notes must come from the real
diff between tags, not from guesswork.

## Validate The Version

- Accept only tags that match `^v\d+\.\d+\.\d+-crove\.\d+$`.
- Reject bare `vX.Y.Z` and reject date-style tags such as `v20260414`.
- Confirm the target tag does not already exist locally or on any configured remote.
- Prefer the latest reachable `-crove.N` tag as the previous release tag.

**The `-crove.N` suffix is load-bearing, not cosmetic.**
`.github/workflows/sync-upstream.yml` lines 79-88 skip the entire upstream sync
when this fork already holds a tag whose name matches the upstream target tag, and
line 121 pushes upstream's tag into the fork afterwards. A bare `v1.7.0` here
would therefore silently disable every future upstream sync the moment upstream
released `v1.7.0`. Upstream owns the plain `vX.Y.Z` namespace; the fork must not
allocate from it.

```bash
python3 .codex/skills/release-version/scripts/collect_release_context.py \
  --repo . \
  --tag v1.7.1-crove.1
```

Pass `--previous-tag` explicitly when the caller already knows the baseline.

## Reconcile dev And main

`dev` is the integration branch: `sync-upstream.yml` merges upstream tags into it
and pushes it directly, and `deploy-beta.yml` builds `:beta` from every push to
it. `main` is the default branch and is what Dependabot scans. The two drift.

Before tagging, check both directions:

```bash
git fetch origin
git rev-list --count origin/main..dev
git rev-list --count dev..origin/main
```

If the second count is non-zero, **merge `origin/main` into `dev` first** and only
then tag. Tagging `dev` while `main` holds commits `dev` lacks ships a release
that silently regresses whatever is on `main`. This is not hypothetical: the
`web/pnpm-workspace.yaml` fix and the dependency overrides that drove Dependabot
from 162 alerts to 34 existed only on `main`, and merging `dev` over `main`
without reconciling first would have reverted them.

Expect a `web/pnpm-lock.yaml` conflict when this happens. Resolve it toward
whichever side was generated together with the current `web/pnpm-workspace.yaml`,
then prove the choice instead of arguing it:

```bash
cd web && pnpm install --frozen-lockfile
```

That is the exact command CI and the Docker build run. `Lockfile is up to date`
plus exit 0 settles it.

After reconciling, bring `main` up to `dev` so the default branch and the release
tag point at the same commit:

```bash
git push origin dev:main
git branch -f main dev
```

## Inspect The Repository

- Check `git status --short`. If the working tree holds unrelated changes, stop
  and ask before proceeding - a release commit must not sweep them up.
- Read the JSON output of `collect_release_context.py`.
- Use the commit list, changed files, and insertions/deletions to decide what is
  user-visible.
- Prioritize behavior changes, new features, fixes, migrations, API changes,
  configuration changes, and documentation changes that matter to adopters.
- Ignore pure formatting churn unless it changes usage.

## Draft The Changelog

Update `CHANGELOG.md` at the repository root. It is English-only and follows Keep
a Changelog. Prepend the new entry directly above the previous one:

```md
## [1.7.1-crove.1] - YYYY-MM-DD

### Security
### Added
### Changed
### Fixed
### Known issues
```

Omit any section that has nothing in it. Keep `### Known issues` even when it is
uncomfortable: it is where regressions this release deliberately did not fix get
recorded, and it is the section adopters most need.

Changelog writing rules:

- Write concise, user-facing summaries instead of raw commit subjects.
- Mention compatibility-sensitive changes explicitly.
- Every claim must trace to a commit, a file, or a command you actually ran.
- State what a fix does *not* cover when the fix is partial. Marking a half-fixed
  issue as fixed is worse than leaving it listed.

## Verify Before Tagging

Run these and report real output. Do not claim a check you did not run.

```bash
go build -tags dev ./...
go vet -tags dev ./...
go test -count=1 -tags dev ./internal/services/... ./internal/repositories/... \
  ./internal/pkg/... ./internal/oidcclient/... ./internal/migration/... \
  ./internal/builders/... ./internal/bootstrap/... ./internal/handlers/...
cd web && pnpm install --frozen-lockfile
cd web && pnpm typecheck
cd web && node --test "**/*.test.mjs"
git diff --check
```

`-tags dev` is required: without it the `//go:embed all:out` directive in
`web/embed.go` fails on a tree that has no `web/out`. `pnpm lint` currently
reports pre-existing `react-hooks` errors (PROC-16) and is wired into CI as
non-blocking, so treat *new* lint errors as the signal rather than the absolute
count.

## Commit And Push The Changelog

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add the vX.Y.Z-crove.N entry"
git push origin dev
git push origin dev:main
```

Stage only the changelog. Never `git add -A` in this repository - other sessions
frequently hold unrelated work in the same tree.

## Create And Push The Tag

```bash
git tag -a v1.7.1-crove.1 -m "Release v1.7.1-crove.1" <commit>
git push origin v1.7.1-crove.1
```

Tag the reconciled commit, not whatever `HEAD` happens to be. Pushing the tag
triggers `deploy-prod.yml` through its `push: tags: v*` rule.

## Create The GitHub Release

Pushing the tag builds the image but publishes nothing human-readable. Create the
Release page on `DOS/Crove-Desk`:

```bash
gh release create v1.7.1-crove.1 \
  --repo DOS/Crove-Desk \
  --title "v1.7.1-crove.1" \
  --notes-file <notes.md>
```

Build the notes body from the new `CHANGELOG.md` entry. If the first attempt
fails, re-run against the existing release with `gh release edit` rather than
creating a second tag.

There is no Gitee mirror for this fork. Do not attempt to publish there.

## Final Verification

- `git rev-parse v1.7.1-crove.1^{tag}` succeeds.
- `git ls-remote --tags origin v1.7.1-crove.1` shows the tag.
- `git rev-parse dev origin/dev main origin/main v1.7.1-crove.1^{commit}` all
  report the same commit.
- The production build finished:
  `gh run list --repo DOS/Crove-Desk --limit 3 --json displayTitle,workflowName,status,conclusion`
- The image tags were actually published. Read them from the build log rather
  than assuming them from the workflow config:
  `gh run view <run-id> --repo DOS/Crove-Desk --log --job <job-id>` filtered for
  `dos/crove-desk:`. Expect `latest`, `X.Y.Z-crove.N` and `vX.Y.Z-crove.N` on one
  shared digest, and confirm `org.opencontainers.image.revision` equals the
  tagged commit.
- `gh release view v1.7.1-crove.1 --repo DOS/Crove-Desk` resolves.

## What This Does Not Do

Neither `deploy-prod.yml` nor `deploy-beta.yml` deploys anything. Both only build
an OCI image and push it to `ghcr.io/dos/crove-desk`. The operator still has to
pull the new image on the host and restart the service. Say so explicitly in the
handoff - a green workflow is not a live release.

## Completion Checklist

- Tag matches `^v\d+\.\d+\.\d+-crove\.\d+$` and exists on no other remote
- `dev` and `main` reconciled, both pointing at the tagged commit
- `CHANGELOG.md` entry derived from the real diff, Known issues included
- Verification suite run, with real output reported
- Annotated tag pushed and `deploy-prod.yml` succeeded
- Published image digest and `org.opencontainers.image.revision` confirmed
- GitHub Release page created on `DOS/Crove-Desk`
- Operator reminded that pulling the image on the host is still manual
