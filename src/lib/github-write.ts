import { GitHubError } from "./github";

// Write operations (branch, commit, PR, repo settings) using the server's GITHUB_TOKEN.
// The app is single-user/self-hosted, so the token owner is the one opening PRs.

const API = "https://api.github.com";

type Method = "GET" | "POST" | "PUT" | "PATCH";

async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubError("Add a GITHUB_TOKEN with write access to .env.local to open PRs.", 401);

  const res = await fetchWithRetry(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "repoglow",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;

  const detail = await res.json().catch(() => ({}) as { message?: string; errors?: { message?: string }[] });
  const msg = [detail.message, ...(detail.errors ?? []).map((e: { message?: string }) => e.message)].filter(Boolean).join(" — ");
  if (res.status === 401) throw new GitHubError("GITHUB_TOKEN is invalid or expired.", 401);
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new GitHubError("GitHub rate limit hit. Try again in a few minutes.", 429);
  }
  if (res.status === 403 || (res.status === 404 && method !== "GET")) {
    throw new GitHubError(`GITHUB_TOKEN doesn't have permission for this (${msg || res.status}). See the README for required scopes.`, 403);
  }
  if (res.status === 404) throw new GitHubError("Repo not found, or GITHUB_TOKEN can't see it.", 404);
  throw new GitHubError(`GitHub API error ${res.status}${msg ? `: ${msg}` : ""}`, 502);
}

/** One retry on network-level failures (connection reset, DNS blip). Creating an existing ref/PR fails with 422, so a retry can't duplicate work. */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    try {
      return await fetch(url, init);
    } catch {
      throw new GitHubError("Couldn't reach GitHub. Check your connection and try again.", 503);
    }
  }
}

type Repo = {
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  fork: boolean;
  archived: boolean;
  permissions?: { admin: boolean; push: boolean };
};

export type GitHubStatus = {
  login: string;
  canPush: boolean;
  canAdmin: boolean;
  archived: boolean;
};

/** Who the token belongs to and what it may do on the target repo. */
export async function getStatus(owner: string, repo: string): Promise<GitHubStatus> {
  const [user, target] = await Promise.all([
    api<{ login: string }>("GET", "/user"),
    api<Repo>("GET", `/repos/${owner}/${repo}`),
  ]);
  return {
    login: user.login,
    canPush: !!target.permissions?.push,
    canAdmin: !!target.permissions?.admin,
    archived: target.archived,
  };
}

export type PrInput = {
  owner: string;
  repo: string;
  readme: string;
  aboutDescription: string;
  topics: string[];
};

export type PrResult = { url: string; number: number; branch: string; viaFork: boolean };

/** Commit the README to a new branch (on a fork if needed) and open a PR against the default branch. */
export async function openReadmePr(input: PrInput): Promise<PrResult> {
  const { owner, repo } = input;
  const upstream = await api<Repo>("GET", `/repos/${owner}/${repo}`);
  if (upstream.archived) throw new GitHubError("This repo is archived — it can't receive pull requests.", 409);
  const me = (await api<{ login: string }>("GET", "/user")).login;
  const base = upstream.default_branch;

  // Push directly when allowed; otherwise work on the token owner's fork.
  const viaFork = !upstream.permissions?.push;
  const head = viaFork ? await ensureFork(owner, repo, me, base) : upstream;
  const headSlug = head.full_name;

  const baseSha = (await api<{ object: { sha: string } }>("GET", `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(base)}`)).object.sha;
  const branch = `repoglow/readme-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
  await api("POST", `/repos/${headSlug}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });

  // Update the README GitHub actually displays (could be readme.md, docs/README.md, ...).
  const existing = await api<{ path: string; sha: string }>("GET", `/repos/${headSlug}/readme?ref=${encodeURIComponent(branch)}`).catch(
    (err) => {
      if (err instanceof GitHubError && err.status === 404) return null;
      throw err;
    },
  );
  const path = existing?.path ?? "README.md";
  await api("PUT", `/repos/${headSlug}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    message: existing ? "docs: polish README" : "docs: add README",
    content: Buffer.from(input.readme, "utf8").toString("base64"),
    branch,
    ...(existing ? { sha: existing.sha } : {}),
  });

  const pr = await api<{ html_url: string; number: number }>("POST", `/repos/${owner}/${repo}/pulls`, {
    title: existing ? "docs: polish README" : "docs: add README",
    head: viaFork ? `${head.owner.login}:${branch}` : branch,
    base,
    body: prBody(input, !!existing),
    maintainer_can_modify: viaFork,
  });

  return { url: pr.html_url, number: pr.number, branch, viaFork };
}

async function ensureFork(owner: string, repo: string, me: string, branch: string): Promise<Repo> {
  // Returns the existing fork if there is one; otherwise starts creating it.
  const fork = await api<Repo>("POST", `/repos/${owner}/${repo}/forks`, { default_branch_only: true });
  // Forking is async: wait until the fork's branch exists.
  for (let i = 0; i < 20; i++) {
    try {
      await api("GET", `/repos/${fork.full_name}/git/ref/heads/${encodeURIComponent(branch)}`);
      break;
    } catch (err) {
      if (!(err instanceof GitHubError) || err.status !== 404 || i === 19) {
        throw err instanceof GitHubError && err.status === 404
          ? new GitHubError("GitHub is still creating your fork. Try again in a minute.", 504)
          : err;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  // An older fork may be behind; bring it up to date so the upstream base commit exists there.
  await api("POST", `/repos/${fork.full_name}/merge-upstream`, { branch }).catch(() => {});
  if (fork.owner.login !== me) throw new GitHubError("Unexpected fork owner.", 502);
  return fork;
}

function prBody(input: PrInput, updating: boolean): string {
  return [
    updating
      ? "This PR refreshes the README with a clearer structure: hero section, badges, features, quick start, usage and contributing guide."
      : "This PR adds a README with a hero section, badges, features, quick start, usage and contributing guide.",
    "",
    "### Suggested repo settings",
    "These can't be changed through a PR — a maintainer can set them under **About ⚙️** on the repo page:",
    "",
    `**Description:** ${input.aboutDescription}`,
    "",
    `**Topics:** ${input.topics.map((t) => `\`${t}\``).join(" ")}`,
    "",
    "---",
    "<sub>Generated with [RepoGlow](https://github.com/nevil-codes/repoglow) and reviewed before opening.</sub>",
  ].join("\n");
}

/** Set the About description and topics directly (requires admin on the repo). */
export async function applyAbout(owner: string, repo: string, description: string, topics: string[]): Promise<void> {
  await api("PATCH", `/repos/${owner}/${repo}`, { description: description.slice(0, 350) });
  await api("PUT", `/repos/${owner}/${repo}/topics`, { names: topics.slice(0, 20) });
}
