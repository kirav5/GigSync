---
name: git-workflow
description: How changes reach collabai.network's main branch. Load BEFORE any git commit, push, branch, merge or PR action in this repo, and whenever asked to "push", "commit", "ship", "deploy" or "merge" anything. Nothing is ever pushed to main directly: every change, code or docs, goes on a branch, through a pull request, with lint run before the commit, a DCO sign-off on every commit, and green CI before merge.
---

# Git workflow for collabai.network

`main` is the live product: every push to it deploys to collabai.network. So nobody, person or agent, pushes to
`main`. Changes travel on a branch, through a pull request, and merge only when CI is green. GitHub cannot
enforce this on a private repo under the free plan, so the committed hooks in `.githooks/` and this skill are the
guard. Treat them as the rule, not a suggestion.

## The rules

1. **Never push to `main`.** Not for a one-line fix, not for a docs typo, not for a hotfix. The `pre-push` hook
   refuses it; do not use `--no-verify` to get around that. If `main` is broken, branch from `main`, fix, PR.
2. **Branch per change.** `git switch -c <type>/<short-name>` from an up-to-date `main`:
   `feat/`, `fix/`, `docs/`, `chore/`, `adr/`. One concern per branch; small PRs merge faster.
3. **Lint before every commit, docs included.** `pnpm lint` runs Biome (which formats Markdown tables and lists),
   the 300-line file check and the magic-string check. The `pre-commit` hook runs it; if it fails, fix the files,
   do not skip the hook. For code changes also run `pnpm typecheck` and `pnpm test` before pushing.
4. **Sign off every commit.** The DCO app is enabled: `git commit -s`. A PR with an unsigned commit fails the
   `DCO` check; fix with `git commit --amend -s --no-edit` and `git push --force-with-lease`.
5. **Commit messages:** a short imperative subject (under 70 characters), a blank line, then why the change
   exists and anything a reviewer must know. End with the attribution lines the session requires.
6. **Open a PR for every branch**: `gh pr create` with a body that says what changed and why, and how it was
   verified. Mark it draft while CI is red or the work is unfinished.
7. **Green before merge.** All checks (`Lint, typecheck, test, build`, `DCO`, and any others) must pass. A red PR
   is never merged, not even to "fix it on main". If a check is flaky, re-run it; if it is wrong, fix the check in
   its own PR.
8. **Squash-merge** and delete the branch. The squash commit keeps the sign-off and attribution from the PR.
9. **Deploys happen from `main` only**, by the Deploy Workers workflow after a merge. Never run `wrangler deploy`
   by hand against production; use the staging environment (H4) for anything that must be tried first.
10. **Keep `main` moving forward.** No force-pushes to `main`, no history rewrites, no reverting someone else's
    merge without talking to them. Revert by PR.

## Shared checkouts

Two people in one working tree is the usual reason hooks "block for no reason": the hook typechecks the whole
tree, including the other person's uncommitted files. If the pre-push hook fails on a file you did not touch,
say so in the PR and use your own clone or `git worktree add ../collab-<name> main`. Never stage files you did not
change (`git add <paths>`, not `git add -A`), and never commit or stash another person's work.

## The sequence, every time

```bash
git switch main && git pull --ff-only
git switch -c fix/<short-name>
# edit
pnpm lint && pnpm typecheck && pnpm test      # the hooks repeat lint and typecheck
git add <paths>
git commit -s -m "<subject>" -m "<why>"
git push -u origin fix/<short-name>
gh pr create --fill
# wait for green, address review, then squash-merge
```

## Agents

Claude Code sessions follow this skill exactly as people do: a session that is asked to "push this" opens a PR
and reports its URL and check status. If a session finds itself on `main` with local commits, it moves them to a
branch (`git switch -c <branch>` then `git branch -f main origin/main`) rather than pushing.
