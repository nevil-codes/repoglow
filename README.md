<div align="center">

<img src="docs/banner.svg" alt="RepoGlow — make your GitHub repo impossible to scroll past" width="100%" />

<br />

**Turn any repo — or a one-line idea — into a polished, star-worthy GitHub project.**
AI-written README, catchy names, About blurb, topics, badges and package picks in one click.

<br />

[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Claude](https://img.shields.io/badge/Claude-Opus_5.5-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://www.anthropic.com/claude)
<br />
[![License: MIT](https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ec4899?style=for-the-badge)](CONTRIBUTING.md)

[**Quick start**](#-quick-start) · [**How it works**](#-how-it-works) · [**Report bug**](../../issues/new?template=bug_report.md) · [**Request feature**](../../issues/new?template=feature_request.md)

</div>

---

## ✨ Why RepoGlow?

Great code gets ignored when the repo looks like an afterthought. A blank README, no topics and a vague description mean nobody finds it — and those who do bounce in seconds.

RepoGlow reads your actual code (file tree, manifests, entry points, existing README) and hands back a complete **polish kit** grounded in what the project really does. No GitHub repo yet? Just describe the idea.

<div align="center">
  <img src="docs/screenshot.png" alt="RepoGlow screenshot" width="90%" />
</div>

## 🚀 Features

| | Feature | What you get |
|---|---|---|
| 📝 | **README generator** | Centered hero, badges, features, quick start with real commands from your manifests, usage, project structure, roadmap, contributing, license |
| 🏷️ | **Name ideas** | 5 memorable, kebab-case names with the reasoning behind each |
| 💬 | **About + tagline** | A crisp ≤350-char GitHub *About* description and a punchy one-liner |
| 🔎 | **Topics** | 8–20 searchable topics mixing language, framework, domain and use case |
| 🛡️ | **Badges** | Ready-to-paste shields.io badges for your stack |
| 📦 | **Package picks** | Stack-aware libraries for testing, DX and features — with install commands |
| ✅ | **Quick wins** | Prioritized checklist: license, CI, templates, social preview, releases… |
| 📊 | **Appeal score** | Before → after score so you know what moved the needle |
| 🎨 | **Tone & style** | Professional · Playful · Minimal · Bold, plus toggles for emoji, TOC and Mermaid diagrams |

Everything is one click to copy, and the README downloads as `README.md`.

## 🧠 How it works

```mermaid
flowchart LR
    A[GitHub URL] --> B[GitHub REST API]
    B -->|tree · README · manifests · key source| C[Repo digest]
    D[Project idea] --> E
    C --> E[Prompt builder]
    E --> F[Claude Opus 5.5<br/>structured output]
    F -->|validated JSON| G[Polish kit UI]
```

1. **Digest** — `src/lib/github.ts` pulls repo metadata, languages, file tree, existing README, manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, …) and a size-budgeted sample of entry-point source files.
2. **Generate** — `src/lib/claude.ts` calls Claude with a cached system prompt and a Zod schema (`src/lib/schema.ts`), so the response is guaranteed to match the shape the UI expects.
3. **Polish** — the UI renders the README preview, names, topics, badges, packages and checklist.

## ⚡ Quick start

**Prerequisites:** Node.js 20+ and an [Anthropic API key](https://console.anthropic.com/).

```bash
git clone https://github.com/nevil-codes/repoglow.git
cd repoglow
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and paste a repo URL.

### Environment variables

| Variable | Required | Description |
|---|:---:|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `GITHUB_TOKEN` | — | Raises GitHub rate limit from 60 to 5,000 req/h. A fine-grained token with no extra scopes is enough |

> [!TIP]
> Hitting `GitHub rate limit` errors while testing? Add a `GITHUB_TOKEN` — unauthenticated requests are capped at 60/hour per IP.

## 🗂️ Project structure

```
src/
├── app/
│   ├── api/generate/route.ts   # POST endpoint: validate → digest → Claude
│   ├── page.tsx                # Landing page + generator form
│   ├── layout.tsx              # Fonts, theme bootstrap, aurora background
│   └── globals.css             # Design tokens, glass + glow styles, markdown preview
├── components/
│   ├── Results.tsx             # Tabs: README · Names · About & Topics · Packages · Badges · Quick wins
│   └── ui.tsx                  # Card, CopyButton, ThemeToggle, icons
└── lib/
    ├── github.ts               # Repo digest via GitHub REST API
    ├── prompt.ts               # System prompt + per-request prompt builder
    ├── claude.ts               # Anthropic SDK call, structured output, error mapping
    └── schema.ts               # Zod schemas for request + polish kit
```

## 🛠️ Tech stack

- **[Next.js 16](https://nextjs.org)** App Router + Route Handlers
- **[Claude Opus 5.5](https://www.anthropic.com/claude)** via [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) with structured outputs
- **[Zod](https://zod.dev)** for request validation and output schema
- **[Tailwind CSS 4](https://tailwindcss.com)** — dark-first glassmorphism UI with light mode
- **[react-markdown](https://github.com/remarkjs/react-markdown)** + `remark-gfm` for safe README preview

## 🗺️ Roadmap

- [x] README, names, About, topics, badges, packages, quick wins
- [x] Tone presets and README style toggles
- [x] Light / dark theme
- [ ] Stream the README as it's written
- [ ] "Open PR with this README" via GitHub OAuth
- [ ] Private repo support
- [ ] Social preview image generator (1280×640)
- [ ] One-click deploy to Vercel

## 🤝 Contributing

Contributions are welcome! Read [CONTRIBUTING.md](CONTRIBUTING.md), then open an issue or PR.

```bash
npm run lint && npx tsc --noEmit && npm run build
```

## 📄 License

[MIT](LICENSE) © Nevil Amraniya

<div align="center">
<br />

If RepoGlow made your repo shine, consider giving it a ⭐

</div>
