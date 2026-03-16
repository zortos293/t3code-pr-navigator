# PR Navigator

A visual board for navigating GitHub issues and pull requests. Add repositories, fetch live data from the GitHub API, and see issues/PRs displayed as interactive nodes with "solved by" relationship edges.

## Features

- **Repository Management** — Add repos by URL or `owner/repo`, sync data from GitHub
- **Interactive Board** — React Flow canvas with draggable issue and PR nodes
- **Label Badges** — Styled badges for `vouch:`, `size:`, `bug`, `enhancement` labels
- **Line Stats** — Shows `+additions` / `-deletions` on each PR card
- **Relationship Mapping** — Draw edges between issues and PRs to mark "solved by"
- **OpenCode Analysis** — Optional OpenCode Go integration for automatic relationship detection and duplicate finding
- **Dark Mode** — Light / Auto / Dark theme toggle
- **SQLite Storage** — Local database via better-sqlite3

## Quick Start

```bash
cp .env.example .local.env
# Add your GITHUB_TOKEN and OPENCODE_GO_API_KEY to .local.env

bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

This repository uses Bun as its package manager and commits `bun.lock` as the only lockfile.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Recommended | GitHub personal access token (increases API rate limits) |
| `OPENCODE_GO_API_KEY` | Optional | OpenCode Go API key used for OpenCode analysis |
| `OPENCODE_GO_MODEL` | No | OpenCode Go chat-completions model id (default: `kimi-k2.5`) |
| `DATABASE_URL` | No | SQLite database path (default: `./data/pr-navigator.db`) |

## Tech Stack

- Next.js 16 (App Router)
- React 19
- React Flow (`@xyflow/react`)
- SQLite (better-sqlite3)
- Tailwind CSS 4
- Octokit (GitHub REST API)
- Lucide React (icons)
