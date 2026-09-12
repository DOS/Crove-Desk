#!/usr/bin/env python3
"""Collect release context between a target tag and its comparison baseline."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SEMVER_TAG_RE = re.compile(r"^v(\d+)\.(\d+)\.(\d+)(?:-crove\.(\d+))?$")

# Only the fork's own tags are valid release targets. SEMVER_TAG_RE stays
# permissive on purpose: it also has to read the bare vX.Y.Z and vYYYYMMDD tags
# inherited from upstream so a baseline can be chosen at all.
FORK_RELEASE_TAG_RE = re.compile(r"^v\d+\.\d+\.\d+-crove\.\d+$")


def run_git(
    repo: Path,
    args: list[str],
    allow_failure: bool = False,
    timeout_seconds: int = 15,
) -> str:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=repo,
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        if allow_failure:
            return ""
        raise RuntimeError(f"git command timed out: git {' '.join(args)}")
    if result.returncode != 0 and not allow_failure:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def parse_semver(tag: str) -> tuple[int, int, int, int] | None:
    """Parse a release tag into a sortable tuple.

    The fourth element is the fork counter from the ``-crove.N`` suffix, treated
    as 0 when absent. Strict semver would rank ``1.7.0-crove.1`` below ``1.7.0``
    as a prerelease; this repository never mints a bare ``vX.Y.Z`` tag, because
    that namespace belongs to upstream and a collision disables
    sync-upstream.yml, so ordering the counter above the plain release is the
    behaviour that actually matters when picking a baseline.
    """
    match = SEMVER_TAG_RE.match(tag)
    if not match:
        return None
    major, minor, patch, crove = match.groups()
    return (int(major), int(minor), int(patch), int(crove) if crove else 0)


def list_reachable_tags(repo: Path) -> list[str]:
    output = run_git(repo, ["tag", "--merged", "HEAD"])
    return [line.strip() for line in output.splitlines() if line.strip()]


def choose_previous_tag(repo: Path, tags: list[str], target_tag: str | None) -> tuple[str | None, str | None]:
    semver_tags: list[tuple[tuple[int, int, int, int], str]] = []
    other_tags: list[str] = []
    target_semver = parse_semver(target_tag) if target_tag else None

    for tag in tags:
        if target_tag and tag == target_tag:
            continue
        parsed = parse_semver(tag)
        if parsed is None:
            other_tags.append(tag)
            continue
        if target_semver is not None and parsed >= target_semver:
            continue
        semver_tags.append((parsed, tag))

    if semver_tags:
        semver_tags.sort(key=lambda item: item[0], reverse=True)
        return semver_tags[0][1], "semver"

    if not other_tags:
        return None, None

    candidates: list[tuple[int, str]] = []
    for tag in other_tags:
        ts = run_git(repo, ["log", "-1", "--format=%ct", tag], allow_failure=True)
        try:
            candidates.append((int(ts), tag))
        except ValueError:
            continue
    if not candidates:
        return other_tags[-1], "fallback"
    candidates.sort(reverse=True)
    return candidates[0][1], "fallback"


def ensure_tag_absent(repo: Path, tag: str) -> None:
    local = run_git(repo, ["tag", "--list", tag])
    if local:
        raise ValueError(f"target tag already exists locally: {tag}")

    remotes_output = run_git(repo, ["remote"])
    for remote in [line.strip() for line in remotes_output.splitlines() if line.strip()]:
        remote_hit = run_git(
            repo,
            ["ls-remote", "--tags", remote, tag],
            allow_failure=True,
            timeout_seconds=8,
        )
        if remote_hit:
            raise ValueError(f"target tag already exists on remote {remote}: {tag}")


def ensure_tag_exists(repo: Path, tag: str) -> None:
    hit = run_git(repo, ["rev-parse", "--verify", "--quiet", tag], allow_failure=True)
    if not hit:
        raise ValueError(f"previous tag does not exist locally: {tag}")


def get_commit_list(repo: Path, rev_range: str) -> list[dict[str, str]]:
    output = run_git(repo, ["log", "--reverse", "--date=short", "--pretty=format:%H%x09%ad%x09%s", rev_range])
    commits: list[dict[str, str]] = []
    for line in output.splitlines():
        commit_hash, date_str, subject = line.split("\t", 2)
        commits.append(
            {
                "hash": commit_hash,
                "short_hash": commit_hash[:7],
                "date": date_str,
                "subject": subject,
            }
        )
    return commits


def get_changed_files(repo: Path, rev_range: str) -> list[str]:
    output = run_git(repo, ["diff", "--name-only", rev_range])
    return [line.strip() for line in output.splitlines() if line.strip()]


def get_numstat(repo: Path, rev_range: str) -> dict[str, int]:
    output = run_git(repo, ["diff", "--numstat", rev_range])
    changed_files = 0
    insertions = 0
    deletions = 0
    for line in output.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        added, removed = parts[0], parts[1]
        changed_files += 1
        if added.isdigit():
            insertions += int(added)
        if removed.isdigit():
            deletions += int(removed)
    return {
        "changed_files": changed_files,
        "insertions": insertions,
        "deletions": deletions,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="Repository root. Defaults to current directory.")
    parser.add_argument("--tag", help="Target release tag to validate, for example v1.7.1-crove.1.")
    parser.add_argument("--previous-tag", help="Explicit comparison baseline.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    repo_path = Path(args.repo).expanduser().resolve()

    if not (repo_path / ".git").exists():
        print(json.dumps({"error": f"not a git repository: {repo_path}"}))
        return 1

    if args.tag and not FORK_RELEASE_TAG_RE.match(args.tag):
        print(json.dumps({
            "error": f"invalid release tag format: {args.tag}",
            "expected": "vx.y.z-crove.n",
            "reason": (
                "a bare vX.Y.Z tag allocates from the upstream namespace, and "
                "sync-upstream.yml skips a sync entirely when this fork already "
                "holds a tag of that name"
            ),
        }))
        return 1

    try:
        if args.tag:
            ensure_tag_absent(repo_path, args.tag)
        if args.previous_tag:
            ensure_tag_exists(repo_path, args.previous_tag)
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}))
        return 1

    tags = list_reachable_tags(repo_path)
    previous_tag = args.previous_tag
    previous_tag_source = "explicit" if previous_tag else None

    if previous_tag is None:
        previous_tag, previous_tag_source = choose_previous_tag(repo_path, tags, args.tag)

    rev_range = "HEAD"
    if previous_tag:
        rev_range = f"{previous_tag}..HEAD"

    try:
        commits = get_commit_list(repo_path, rev_range)
        changed_files = get_changed_files(repo_path, rev_range)
        stats = get_numstat(repo_path, rev_range)
        head_commit = run_git(repo_path, ["rev-parse", "HEAD"])
    except RuntimeError as exc:
        print(json.dumps({"error": str(exc)}))
        return 1

    payload: dict[str, object] = {
        "repo": str(repo_path),
        "target_tag": args.tag,
        "previous_tag": previous_tag,
        "previous_tag_source": previous_tag_source,
        "rev_range": rev_range,
        "head_commit": head_commit,
        "commit_count": len(commits),
        "commits": commits,
        "changed_files": changed_files,
    }
    payload.update(stats)

    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
