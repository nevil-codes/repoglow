import { NextResponse } from "next/server";
import { GenerateRequest } from "@/lib/schema";
import { digestRepo, GitHubError } from "@/lib/github";
import { generatePolish, GenerationError } from "@/lib/llm";
import type { GenerateEvent } from "@/lib/events";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = GenerateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;
  const encoder = new TextEncoder();

  // NDJSON stream: progress stages, metadata as soon as it's ready, then README snapshots.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: GenerateEvent) => {
        if (req.signal.aborted) return;
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      };
      try {
        let digest;
        if (input.mode === "repo") {
          emit({ type: "stage", stage: "digest" });
          digest = await digestRepo(input.repoUrl!);
          emit({ type: "repo", repo: { fullName: digest.meta.full_name, url: digest.meta.html_url } });
        }
        const polish = await generatePolish(input, digest, emit, req.signal);
        emit({ type: "done", polish });
      } catch (err) {
        if (err instanceof GitHubError || err instanceof GenerationError) {
          emit({ type: "error", error: err.message });
        } else {
          console.error(err);
          emit({ type: "error", error: "Something went wrong. Please try again." });
        }
      } finally {
        if (!req.signal.aborted) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
