import type { GenerateRequest, PolishMeta } from "./schema";
import { BADGES_TOKEN, TOC_TOKEN } from "./readme";

// Shared by both calls and kept byte-stable so Ollama can reuse the cached
// prompt prefix (system prompt + project context) for the second call.
export const SYSTEM_PROMPT = `You are RepoGlow, an expert open-source maintainer and developer-experience designer. You turn GitHub repositories into ones people star, share, and contribute to.

You receive either a digest of a real repository or a description of a project idea, followed by a task.

Ground rules:
- Base every claim on the repo digest or the user's description. Never invent features, version numbers, download counts, benchmarks, quotes, URLs, or package names.
- If something is unknown (screenshot, demo link), use an HTML comment placeholder like <!-- TODO: add screenshot -->.

README rules:
- Structure: centered hero (title, one-line tagline, ${BADGES_TOKEN}, quick links), short "why" paragraph, ${TOC_TOKEN}, Features, Tech Stack, Getting Started (prerequisites, install, run - real commands from the manifests), Usage with a code example, Project Structure (trimmed tree, real repos only), Roadmap (task list), Contributing, License.
- Write the literal token ${BADGES_TOKEN} on its own line where badges go and ${TOC_TOKEN} on its own line where the table of contents goes. Never write badges or a table of contents yourself.
- GitHub-flavored markdown: tables, task lists, <details> for long sections, > [!TIP] / > [!NOTE] alerts where useful.
- Headings are plain markdown (## Title). Never put HTML tags inside a heading line.
- Skimmable: short paragraphs, consistent heading levels, no filler.

Example of the expected README style and structure (a different project - copy the shape, never the content):
<example_readme>
<div align="center">

# 🦉 nightowl

**Schedule-aware dark mode for every app on your desktop.**

${BADGES_TOKEN}

[Report Bug](https://github.com/acme/nightowl/issues) · [Request Feature](https://github.com/acme/nightowl/issues)

</div>

## ✨ Why nightowl?

Most apps ship their own dark mode toggle, and none of them agree on when night starts. nightowl switches every supported app at sunset and back at sunrise, based on your location.

${TOC_TOKEN}

## 🚀 Features

| Feature | Description |
|---|---|
| 🌅 Sun-based schedule | Switches at local sunset/sunrise |
| ⚡ Instant | Uses each app's native theme API, no restarts |
| 🧩 Plugins | Add apps with a 20-line plugin |

## 🛠️ Tech Stack

- **Rust** - core daemon
- **tokio** - async runtime

## ⚡ Getting Started

\`\`\`bash
cargo install nightowl
nightowl init
\`\`\`

## 📖 Usage

\`\`\`bash
nightowl status   # show current mode and next switch
\`\`\`

## 🗺️ Roadmap

- [x] macOS support
- [ ] Linux (GNOME) support

## 🤝 Contributing

PRs welcome! Open an issue first for big changes.

## 📄 License

MIT
</example_readme>`;

const TONES: Record<GenerateRequest["tone"], string> = {
  professional: "Professional and polished - clear, confident, enterprise-friendly.",
  playful: "Playful and friendly - warm voice, light humor, generous emoji.",
  minimal: "Minimal and elegant - sparse, precise, very little decoration.",
  bold: "Bold and hype - energetic, punchy headlines, strong visual hierarchy.",
};

/** Project source + preferences. Identical for both calls so the prefix cache hits. */
export function buildContext(req: GenerateRequest, digest?: string): string {
  const o = req.options;
  const prefs = [
    `Tone: ${TONES[req.tone]}`,
    `Emoji in headings: ${o.emojis ? "yes" : "no"}`,
    `Mermaid architecture/flow diagram: ${o.diagram ? "yes, one diagram, if it adds clarity" : "no"}`,
  ].join("\n");

  const source =
    req.mode === "repo"
      ? `<repo_digest>\n${digest}\n</repo_digest>`
      : `<project_idea>\n${req.description}\n</project_idea>\nThere is no code yet; describe the project as planned, with placeholders for unknowns.`;

  return `${source}\n\n<preferences>\n${prefs}\n</preferences>`;
}

export const META_TASK = `<task>
Produce the repo polish kit metadata as JSON matching the provided schema:
- names: exactly 5 options, lowercase-kebab-case. For an existing repo, include the current name only if it is genuinely the best.
- tagline: punchy, under 80 characters.
- aboutDescription: what it does and for whom, under 350 characters.
- topics: 8-20, lowercase-hyphenated, mixing language, framework, domain and use case.
- packages: 3-8 real, well-known, maintained packages for this stack that the project does not already use.
- badges: static shields.io badges only (https://img.shields.io/badge/...) for the tech stack.
- improvements: concrete repo-level quick wins not already present (license, CI, issue templates, social preview, releases, demo GIF...).
- scorecard: honest. Idea mode: current = 50.
Respond only with the JSON.
</task>`;

export function readmeTask(meta: PolishMeta, title: string): string {
  return `<task>
Write the complete README.md for this project.
- Title: ${title}
- Tagline: ${meta.tagline}
Follow the README rules and the example's structure. Output only the raw README markdown - no code fence around it, no commentary.
</task>`;
}
