import { NextResponse } from "next/server";
import { z } from "zod";
import { GitHubError, parseRepo } from "@/lib/github";
import { openReadmePr } from "@/lib/github-write";
import { guardWrite } from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  repo: z.string(),
  readme: z.string().min(1).max(200_000),
  aboutDescription: z.string().max(350),
  topics: z.array(z.string()).max(20),
});

export async function POST(req: Request) {
  const blocked = guardWrite(req);
  if (blocked) return blocked;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { repo: slug, ...content } = parsed.data;
    const pr = await openReadmePr({ ...parseRepo(slug), ...content });
    return NextResponse.json(pr);
  } catch (err) {
    if (err instanceof GitHubError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Couldn't open the pull request." }, { status: 500 });
  }
}
