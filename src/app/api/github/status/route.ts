import { NextResponse, type NextRequest } from "next/server";
import { GitHubError, parseRepo } from "@/lib/github";
import { getStatus } from "@/lib/github-write";

export const runtime = "nodejs";

// GET /api/github/status?repo=owner/name — token owner + permissions on the repo.
export async function GET(req: NextRequest) {
  if (!process.env.GITHUB_TOKEN) return NextResponse.json({ configured: false });
  try {
    const { owner, repo } = parseRepo(req.nextUrl.searchParams.get("repo") ?? "");
    return NextResponse.json({ configured: true, ...(await getStatus(owner, repo)) });
  } catch (err) {
    const status = err instanceof GitHubError ? err.status : 500;
    const error = err instanceof GitHubError ? err.message : "Couldn't check GitHub access.";
    return NextResponse.json({ configured: true, error }, { status });
  }
}
