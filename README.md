<div align="center">

# repoglow

**Generate polished README, badges, and project assets in one click.**

[![CI](https://img.shields.io/github/actions/workflow/status/nevil-codes/repoglow/ci.yml?style=for-the-badge&label=CI)](https://github.com/nevil-codes/repoglow/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/nevil-codes/repoglow?style=for-the-badge)](https://github.com/nevil-codes/repoglow/blob/HEAD/LICENSE)
[![Stars](https://img.shields.io/github/stars/nevil-codes/repoglow?style=for-the-badge)](https://github.com/nevil-codes/repoglow/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/nevil-codes/repoglow?style=for-the-badge)](https://github.com/nevil-codes/repoglow/commits)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
<!-- repoglow-e2e-test -->

[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Ollama](https://img.shields.io/badge/Ollama-local_AI-000?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge)](LICENSE)

[Report Bug](../../issues/new?template=bug_report.md) · [Request Feature](../../issues/new?template=feature_request.md)

</div>

## ✨ Why repoglow?

Writing a great README is often the hardest part of starting an open‑source project. A clear title, concise description, and well‑structured documentation can mean the difference between being discovered or ignored.  
repoglow turns any public GitHub repository—or even just a one‑line idea—into a complete, star‑worthy package: it reads your code, extracts real facts from manifests, and generates an AI‑crafted README that follows proven conventions. No API keys, no cost, everything runs locally on Ollama.

<details>
<summary><b>Table of contents</b></summary>

- [✨ Why repoglow?](#-why-repoglow)
- [🚀 Features](#-features)
- [🛠️ Tech Stack](#-tech-stack)
- [⚡ Getting Started](#-getting-started)
- [📖 Usage](#-usage)
- [🗺️ Project structure](#-project-structure)
- [🗺️ Roadmap](#-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

</details>

## 🚀 Features

| Feature | Description |
|---|---|
| 📝 **README generator** | Centered hero, badges, features, quick start with real commands from your manifests, usage example, project structure, roadmap, contributing, license |
| 🏷️ **Name ideas** | 5 memorable, kebab‑case names with reasoning |
| 💬 **About & tagline** | Crisp ≤350‑char GitHub *About* and a punchy one‑liner |
| 🔎 **Topics** | 8–20 searchable topics mixing language, framework, domain and use case |
| 🛡️ **Badges** | Real badges for license, CI, package versions, stars and more |
| 📦 **Package picks** | Stack‑aware libraries for testing, DX and features with install commands |
| ✅ **Quick wins** | Prioritized checklist: license, CI, templates, social preview, releases… |
| 📊 **Appeal score** | Before → after score so you know what moved the needle |
| ⚡ **Live streaming** | Names, topics and packages appear first, then watch the README being written |
| 🔍 **Fact‑checked** | Badges, versions and package picks verified against your real manifests |
| 🎨 **Tone & style** | Professional · Playful · Minimal · Bold, plus toggles for emoji, TOC and Mermaid diagrams |

## 🛠️ Tech Stack

- **Next.js 16** – App Router + Route Handlers
- **TypeScript 5** – type safety throughout the project
- **Tailwind CSS 4** – dark‑first glassmorphism UI
- **Ollama** – local LLM inference (no external API keys)
- **Zod** – schema validation for requests and responses
- **react-markdown + remark-gfm** – secure README preview

## ⚡ Getting Started

### Prerequisites

- Node.js 20+  
- [Ollama](https://ollama.com) running locally (default host `http://127.0.0.1:11434`)

```bash
# Pull a suitable model – 20 B works well for most repos
ollama pull gpt-oss:20b   # or qwen3, llama3.1:8b, …

# Clone the repo and install dependencies
git clone https://github.com/nevil-codes/repoglow.git
cd repoglow
npm install

# Optional – override model or context size
cp .env.example .env.local
```

### Run locally

```bash
npm run dev
```

Open <http://localhost:3000> and paste a GitHub repo URL (or describe an idea) to generate your polished README.

## 📖 Usage

The web UI is the primary entry point.  
Below is how you can call the generation endpoint directly:

```bash
curl -X POST http://localhost:3000/api/generate \
     -H "Content-Type: application/json" \
     -d '{
           "mode":"repo",
           "url":"https://github.com/owner/repo",
           "tone":"professional",
           "options":{
             "badges":true,
             "emojis":true,
             "toc":true,
             "diagram":true
           }
         }'
```

The response is a stream of NDJSON events that the client renders in real time.

## 🗺️ Project structure

```
src/
├── app/
│   ├── api/generate/route.ts   # Streaming POST endpoint
│   ├── page.tsx                # Home page with form
│   ├── layout.tsx              # Root layout & theme bootstrap
│   └── globals.css             # Design tokens and markdown styles
├── components/
│   ├── Results.tsx             # Tabs for README, names, etc.
│   └── ui.tsx                  # UI primitives (Card, CopyButton)
└── lib/
    ├── github.ts               # GitHub API wrapper & digest logic
    ├── prompt.ts               # Prompt templates and preferences
    ├── llm.ts                  # Local LLM orchestration
    ├── readme.ts               # Badge building & finalization
    ├── stack.ts                # Dependency parsing & tooling detection
    └── schema.ts               # Zod schemas for requests/responses
```

## 🗺️ Roadmap

- [x] README, names, About, topics, badges, packages, quick wins  
- [x] Tone presets and README style toggles  
- [x] Light / dark theme support  
- [x] Live streaming of results  
- [x] Manifest‑based fact checking for badges and packages  
- [ ] "Open PR with this README" via GitHub OAuth  
- [ ] Private repo support  
- [ ] Social preview image generator (1280 × 640)  
- [ ] One‑click deploy to Vercel  

## 🤝 Contributing

1. Fork the repository and create a feature branch.  
2. Run `npm run lint && npx tsc --noEmit && npm run build` to ensure TypeScript type‑check passes and code is linted.  
3. Open an issue or PR – we welcome any enhancements, bug fixes, or documentation updates.

## 📄 License

MIT © Nevil Amraniya

<div align="center">

If repoglow helped your project shine, consider giving it a ⭐

</div>
