import { NextResponse } from "next/server";
import { z } from "zod";
import { GitHubError, parseRepo } from "@/lib/github";
import { applyAbout } from "@/lib/github-write";
import { guardWrite } from "@/lib/guard";

export const runtime = "nodejs";

const Body = z.object({
  repo: z.string(),
  aboutDescription: z.string().min(1).max(350),
  topics: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,49}$/)).max(20),
});

export async function POST(req: Request) {
  const blocked = guardWrite(req);
  if (blocked) return blocked;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid description or topics." }, { status: 400 });

  try {
    const { owner, repo } = parseRepo(parsed.data.repo);
    await applyAbout(owner, repo, parsed.data.aboutDescription, parsed.data.topics);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GitHubError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Couldn't update the repo settings." }, { status: 500 });
  }
}
