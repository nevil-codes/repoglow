import { NextResponse } from "next/server";
import { GenerateRequest } from "@/lib/schema";
import { digestRepo, GitHubError } from "@/lib/github";
import { generatePolish, GenerationError } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = GenerateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const digest = input.mode === "repo" ? await digestRepo(input.repoUrl!) : undefined;
    const polish = await generatePolish(input, digest);
    return NextResponse.json({
      polish,
      repo: digest
        ? {
            fullName: digest.meta.full_name,
            url: digest.meta.html_url,
            stars: digest.meta.stargazers_count,
            description: digest.meta.description,
            topics: digest.meta.topics,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof GitHubError || err instanceof GenerationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
