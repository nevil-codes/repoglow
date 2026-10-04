import { NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * GitHub write routes act with the server owner's token, so only accept them:
 * - from the app's own page (Origin must match Host) with a JSON body — blocks
 *   other websites from triggering PRs through the user's browser (CSRF), and
 * - on localhost, unless REPOGLOW_ALLOW_REMOTE_WRITE=true — so a deployed or
 *   LAN-exposed instance can't be used by others to act as the token owner.
 * Returns an error response, or null when the request may proceed.
 */
export function guardWrite(req: Request): NextResponse | null {
  const host = req.headers.get("host") ?? "";
  const origin = req.headers.get("origin");
  const hostname = host.replace(/:\d+$/, "");

  if (!origin || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
  }
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Expected application/json." }, { status: 415 });
  }
  if (!LOCAL_HOSTS.has(hostname) && process.env.REPOGLOW_ALLOW_REMOTE_WRITE !== "true") {
    return NextResponse.json(
      { error: "GitHub actions are only enabled when RepoGlow runs on localhost." },
      { status: 403 },
    );
  }
  return null;
}
