# Changelog Style

Use this guide when drafting the new entry in `CHANGELOG.md` at the repository
root.

The fork keeps a single English changelog in Keep a Changelog format. The
bilingual `docs/zh/docs/changelog.md` and `docs/en/docs/changelog.md` files this
guide used to point at belonged to the upstream `docs` submodule, which was
removed in upstream PR #35 and no longer exists here.

## Goal

Turn Git history into short release notes that explain what changed for adopters.

## Structure

```md
## [X.Y.Z-crove.N] - YYYY-MM-DD

### Security
### Added
### Changed
### Fixed
### Known issues
```

Omit empty sections. Never omit `Known issues` when something is knowingly
unfixed - that section is the one adopters rely on most, and a release that hides
its own gaps gets distrusted.

## Keep

- New user-facing features.
- Bug fixes with clear impact.
- Security fixes, stated as what an attacker could do before and cannot now.
- Breaking or compatibility-sensitive changes.
- API, configuration, deployment, model, workflow, or schema changes that affect usage.
- Important documentation updates when they unlock new workflows.

## Drop Or Compress

- Pure refactors with no visible effect.
- Formatting-only changes.
- Internal rename churn.
- Mechanical dependency updates unless they fix a real issue. A dependency sweep
  is one bullet with the alert count, not one bullet per package.

## Style

- Use concise bullets in the imperative or past tense, consistently within an entry.
- Prefer product or workflow language over commit jargon.
- Start with the effect, then mention the area if needed.
- Keep terms consistent across bullets.
- Name the file, symbol, or endpoint when that is what an adopter would search for.
- Do not copy commit subjects. They describe the patch; the changelog describes
  the consequence.

Example:

```md
- Improved conversation list querying and filtering so operators can locate
  problem cases faster.
- Fixed error handling in the message send flow to prevent UI state from drifting
  after partial failures.
```

## Partial Fixes

When a fix closes only part of a reported issue, say which part and why the rest
is open. "Fixed X" on a half-fixed X is worse than no entry, because it removes
the issue from everyone's tracking without removing it from the product.

Example:

```md
- Closed the privilege-escalation path in password reset: a non-super-admin can no
  longer reset a super_admin's password. The endpoint still returns the new
  plaintext password in the response body, because the dashboard dialog depends on
  it; replacing that needs an email-based flow first.
```

## Grouping Heuristics

- Merge multiple commits into one bullet when they deliver one outcome.
- Separate bullets when the audience or impact differs.
- Keep related security items together under `### Security` even when they landed
  in different commits.

## Before Finalizing

- Re-check that every bullet is supported by the diff.
- Remove statements that depend on assumptions you cannot verify from code, tests,
  or commits.
- Verify version numbers, alert counts, and commit hashes you cite are the real
  ones. Wrong numbers in a changelog outlive the release.
- Keep the notes short enough to scan in under a minute.
