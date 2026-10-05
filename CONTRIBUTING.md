# Contributing to RepoGlow

Thanks for wanting to make RepoGlow better! ✨

## Getting set up

1. Fork and clone the repo.
2. `npm install`
3. Install [Ollama](https://ollama.com) and pull a model: `ollama pull gpt-oss:20b`.
4. `cp .env.example .env.local` (optionally set `OLLAMA_MODEL` and `GITHUB_TOKEN`).
5. `npm run dev` and open http://localhost:3000.

## Making changes

- Create a branch: `git checkout -b feat/short-description`.
- Keep PRs focused — one feature or fix per PR.
- Match the existing style (TypeScript, Tailwind utility classes, small components).
- If you change the polish-kit shape, update `src/lib/schema.ts` **and** the UI in `src/components/Results.tsx`.
- Post-processing and stack detection (`src/lib/readme.ts`, `src/lib/stack.ts`) have unit tests — when you fix a bad model output, add it as a test case.
- Prompt changes live in `src/lib/prompt.ts`. Keep `SYSTEM_PROMPT` stable text (it's prompt-cached); put per-request details in `buildUserPrompt`.

## Before opening a PR

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Include a screenshot or short clip for UI changes.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.

## Reporting bugs / requesting features

Use the [issue templates](../../issues/new/choose). For bugs, include the repo URL or idea you used (if public) and the error message shown.
