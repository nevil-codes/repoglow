import { Ollama, type Message } from "ollama";
import { z } from "zod";
import type { RepoDigest } from "./github";
import { buildContext, META_TASK, readmeTask, SYSTEM_PROMPT } from "./prompt";
import { buildBadges, finalizeReadme } from "./readme";
import { PolishMeta, type GenerateRequest, type RepoPolish } from "./schema";

export class GenerationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL || "gpt-oss:20b";
// Ollama's default context is small and silently truncates long prompts; the repo digest needs room.
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX) || 32768;

const ollama = new Ollama({ host: HOST });
const META_FORMAT = z.toJSONSchema(PolishMeta);

/**
 * Two calls: metadata as schema-constrained JSON, then the README as plain
 * markdown. Splitting keeps the README out of a JSON string (where local
 * models write worse markdown) and gives each call its own output budget.
 */
export async function generatePolish(req: GenerateRequest, digest?: RepoDigest): Promise<RepoPolish> {
  const context = buildContext(req, digest?.text);
  const meta = normalize(await generateMeta(context));

  const title = digest?.facts.repo ?? meta.names[0]?.name ?? "my-project";
  const rawReadme = await chat([{ role: "user", content: `${context}\n\n${readmeTask(meta, title)}` }]);
  if (!rawReadme.trim()) throw new GenerationError(`${MODEL} returned an empty README. Please try again.`, 502);

  const badges = buildBadges(digest?.facts, meta.badges);
  const readme = finalizeReadme(rawReadme, {
    badges: req.options.badges ? badges : null,
    toc: req.options.toc,
    facts: digest?.facts,
    name: title,
  });

  return { ...meta, badges, readme };
}

async function generateMeta(context: string): Promise<PolishMeta> {
  // Local models occasionally emit schema-valid JSON that fails Zod checks; one retry fixes most of it.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await chat([{ role: "user", content: `${context}\n\n${META_TASK}` }], META_FORMAT);
      return PolishMeta.parse(JSON.parse(out));
    } catch (err) {
      if (err instanceof GenerationError) throw err;
      lastError = err;
    }
  }
  console.error(lastError);
  throw new GenerationError(`${MODEL} returned output that didn't match the expected format. Try again or use a larger model.`, 502);
}

async function chat(messages: Message[], format?: object): Promise<string> {
  try {
    // Streamed so slow local generations don't hit fetch header timeouts.
    const stream = await ollama.chat({
      model: MODEL,
      stream: true,
      format,
      options: { num_ctx: NUM_CTX, temperature: 0.7 },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    });

    let out = "";
    let doneReason = "";
    for await (const part of stream) {
      out += part.message.content;
      if (part.done) doneReason = part.done_reason;
    }
    if (doneReason === "length") {
      throw new GenerationError("Output hit the model's length limit. Raise OLLAMA_NUM_CTX or turn off some README options.", 502);
    }
    return out;
  } catch (err) {
    if (err instanceof GenerationError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    if (/ECONNREFUSED|fetch failed/i.test(message + cause)) {
      throw new GenerationError(`Can't reach Ollama at ${HOST}. Is it running? Start it with \`ollama serve\`.`, 503);
    }
    if (/not found/i.test(message)) {
      throw new GenerationError(`Model "${MODEL}" isn't installed. Run \`ollama pull ${MODEL}\` or set OLLAMA_MODEL.`, 500);
    }
    throw new GenerationError(`Ollama error: ${message}`, 502);
  }
}

const kebab = (s: string) =>
  s
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Enforce GitHub naming rules that smaller local models tend to ignore. */
function normalize(p: PolishMeta): PolishMeta {
  const topics = [...new Set(p.topics.map((t) => kebab(t).slice(0, 50)).filter(Boolean))].slice(0, 20);
  const seen = new Set<string>();
  const names = p.names
    .map((n) => ({ ...n, name: kebab(n.name) }))
    .filter((n) => n.name && !seen.has(n.name) && seen.add(n.name));
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return {
    ...p,
    names,
    topics,
    scorecard: { ...p.scorecard, current: clamp(p.scorecard.current), potential: clamp(p.scorecard.potential) },
  };
}
