# Git Workflow & Quality Gates

This document captures the minimum Git hygiene required for the capstone project.
It mirrors the workshop requirements so tutors can verify compliance quickly.

## Branching Strategy
- Every feature, bug fix, or refactor starts from `sprint3` (or the current sprint
  branch) and lives in its own branch.
- Use the ticket prefix plus a short description, e.g.
  `W16B-42-ai-user-dashboard` or `bugfix/W16B-18-login-timeout`.
- Keep the branch focused on **one deliverable** so that rebases and reviews stay
  manageable.

## Commits
- Commit in small, logical chunks (~50–150 lines of diff is ideal).
- Each commit message must describe both the “what” and the “why”. Recommended
  format: `W16B-42: add skeleton loader for analytics cards`.
- Avoid dumping secrets or build artefacts in commits—`.env`, `node_modules`,
  compiled assets, and database dumps stay out of Git.

## Pull Requests
1. Open a PR from the feature branch into `sprint3` (or `main` once sprint branches
   are merged).
2. Add at least one reviewer. Reviews must include **meaningful comments**—call out
   risks, ask clarifying questions, or acknowledge testing.
3. Ensure the PR description links to Jira/issue IDs and summarises testing evidence.
4. Do not self‑merge: wait for ✅ review plus green CI before merging.

The default pull request template in `.github/pull_request_template.md`
re-states the checklist above.

## CI / CD Gates
GitHub Actions (`.github/workflows/ci.yml`) runs automatically on every push or PR:

| Job | Purpose |
| --- | --- |
| `backend-tests` | Installs Python deps, runs `ruff` linting, `python manage.py check`, and `python manage.py test`. |
| `frontend-lint` | Installs Node deps and runs `npm run lint` (ESLint over all React source files). |

Only merge after both jobs succeed. If a job fails locally, use the same commands
before pushing to keep CI green.

## FAQ
- **How do I enforce the commit template?** Run  
  `git config commit.template .github/commit-template.txt` (optional helper file).
- **What if the change spans multiple tickets?** Split into multiple branches/PRs.
- **Can I bypass CI for docs?** No—these fast checks protect us from regressions.

Following this workflow ensures we hit the “Git (20%)” rubric while keeping the
codebase clean for future teammates and tutors reviewing the project.
