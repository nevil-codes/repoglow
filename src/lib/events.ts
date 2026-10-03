import type { PolishMeta, RepoPolish } from "./schema";

export type Stage = "digest" | "meta" | "readme";

export type RepoInfo = { fullName: string; url: string };

/** Newline-delimited JSON events streamed by POST /api/generate. */
export type GenerateEvent =
  | { type: "stage"; stage: Stage }
  | { type: "repo"; repo: RepoInfo }
  | { type: "meta"; meta: PolishMeta }
  // Full README so far (already post-processed), not a delta — simpler client, ~5KB per update.
  | { type: "readme"; markdown: string }
  | { type: "done"; polish: RepoPolish }
  | { type: "error"; error: string };
