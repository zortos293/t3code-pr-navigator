# PR Navigator

A visual board for navigating GitHub issues and pull requests. Add repositories, fetch live data from the GitHub API, and see issues/PRs displayed as interactive nodes with "solved by" relationship edges.

## Features

- **Repository Management** — Add repos by URL or `owner/repo`, sync data from GitHub
- **Interactive Board** — React Flow canvas with draggable issue and PR nodes
- **Label Badges** — Styled badges for `vouch:`, `size:`, `bug`, `enhancement` labels
- **Line Stats** — Shows `+additions` / `-deletions` on each PR card
- **Relationship Mapping** — Draw edges between issues and PRs to mark "solved by"
- **AI Analysis** — Optional Copilot SDK integration for automatic relationship detection and duplicate finding
- **Dark Mode** — Light / Auto / Dark theme toggle
- **SQLite Storage** — Local database via better-sqlite3

## Quick Start

```bash
cp .env.example .env.local
# Add your GITHUB_TOKEN to .env.local

pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Recommended | GitHub personal access token (increases API rate limits) |
| `COPILOT_TOKEN` | Optional | GitHub Copilot API token for AI analysis |
| `DATABASE_URL` | No | SQLite database path (default: `./data/pr-navigator.db`) |

## Tech Stack

- Next.js 14 (App Router)
- React Flow (`@xyflow/react`)
- SQLite (better-sqlite3)
- Tailwind CSS
- Octokit (GitHub REST API)
- Lucide React (icons)
