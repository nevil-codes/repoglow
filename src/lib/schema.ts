import { z } from "zod";

// What the model returns. Length/count limits live in descriptions (and are
// enforced again in the prompt) because JSON-schema output only guarantees shape.
export const RepoPolish = z.object({
  names: z
    .array(
      z.object({
        name: z.string().describe("Repo-safe name, lowercase-kebab-case"),
        why: z.string().describe("One sentence on why it works"),
      }),
    )
    .describe("5 catchy, memorable, available-sounding repo names"),
  tagline: z.string().describe("Punchy one-liner, max ~80 chars"),
  aboutDescription: z
    .string()
    .describe("GitHub 'About' description, max 350 chars, may start with one emoji"),
  topics: z
    .array(z.string())
    .describe("8-20 GitHub topics: lowercase, hyphenated, no spaces, max 50 chars each"),
  packages: z
    .array(
      z.object({
        name: z.string(),
        ecosystem: z.string().describe("npm, pip, cargo, go, etc."),
        why: z.string(),
        installCmd: z.string(),
      }),
    )
    .describe("Packages worth adding to improve quality, DX, or features"),
  badges: z
    .array(
      z.object({
        label: z.string(),
        markdown: z.string().describe("shields.io badge markdown"),
      }),
    )
    .describe("Relevant shields.io badges"),
  readme: z.string().describe("Complete README.md in GitHub-flavored markdown"),
  improvements: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        impact: z.enum(["high", "medium", "low"]),
      }),
    )
    .describe("Quick wins to make the repo stand out"),
  scorecard: z.object({
    current: z.number().describe("0-100 appeal score of repo as it is now (50 for idea mode)"),
    potential: z.number().describe("0-100 score after applying suggestions"),
    notes: z.string().describe("One or two sentences explaining the scores"),
  }),
});

export type RepoPolish = z.infer<typeof RepoPolish>;

// First call returns everything except the README, which is generated separately as plain markdown.
export const PolishMeta = RepoPolish.omit({ readme: true });
export type PolishMeta = z.infer<typeof PolishMeta>;

export const Tone = z.enum(["professional", "playful", "minimal", "bold"]);
export type Tone = z.infer<typeof Tone>;

export const GenerateRequest = z
  .object({
    mode: z.enum(["repo", "idea"]),
    repoUrl: z.string().trim().optional(),
    description: z.string().trim().max(5000).optional(),
    tone: Tone.default("professional"),
    options: z
      .object({
        badges: z.boolean().default(true),
        emojis: z.boolean().default(true),
        toc: z.boolean().default(true),
        diagram: z.boolean().default(true),
      })
      .default({ badges: true, emojis: true, toc: true, diagram: true }),
  })
  .refine((r) => (r.mode === "repo" ? !!r.repoUrl : !!r.description && r.description.length >= 10), {
    message: "Provide a GitHub URL, or a description of at least 10 characters.",
  });

export type GenerateRequest = z.infer<typeof GenerateRequest>;
