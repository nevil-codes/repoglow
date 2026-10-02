const API = "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function parseRepo(input: string): { owner: string; repo: string } {
  const cleaned = input
    .trim()
    .replace(/^git@github\.com:/, "")
    .replace(/^https?:\/\/(www\.)?github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new GitHubError("That doesn't look like a GitHub repo. Try https://github.com/owner/repo", 400);
  }
  return { owner, repo };
}

async function gh<T>(path: string, raw = false): Promise<T> {
  const headers: Record<string, string> = {
    Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "repoglow",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(`${API}${path}`, { headers, cache: "no-store" });
  if (res.status === 404) throw new GitHubError("Repo not found (or it's private).", 404);
  if (res.status === 403 || res.status === 429) {
    throw new GitHubError("GitHub rate limit hit. Add a GITHUB_TOKEN to .env.local or try again later.", 429);
  }
  if (!res.ok) throw new GitHubError(`GitHub API error ${res.status}`, 502);
  return (raw ? res.text() : res.json()) as Promise<T>;
}

const MANIFESTS = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "setup.py",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile",
  "composer.json",
  "pubspec.yaml",
  "Package.swift",
  "Dockerfile",
  "docker-compose.yml",
  "Makefile",
];

const SOURCE_EXT = /\.(ts|tsx|js|jsx|py|go|rs|java|kt|rb|php|swift|dart|c|cpp|h|cs|vue|svelte)$/;
const SKIP_DIR = /(^|\/)(node_modules|dist|build|vendor|\.next|target|__pycache__|\.venv|coverage|test|tests|__tests__)\//;

const TREE_LIMIT = 400;
const FILE_BUDGET = 60_000; // chars of source to send
const PER_FILE = 6_000;

type Tree = { tree: { path: string; type: string; size?: number }[]; truncated: boolean };
type RepoMeta = {
  full_name: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  license: { spdx_id: string } | null;
  topics: string[];
  homepage: string | null;
  html_url: string;
};

export type RepoDigest = { meta: RepoMeta; text: string };

/** Fetch enough of a public repo for Claude to understand it. */
export async function digestRepo(input: string): Promise<RepoDigest> {
  const { owner, repo } = parseRepo(input);
  const base = `/repos/${owner}/${repo}`;

  const meta = await gh<RepoMeta>(base);
  const [languages, tree, readme] = await Promise.all([
    gh<Record<string, number>>(`${base}/languages`),
    gh<Tree>(`${base}/git/trees/${encodeURIComponent(meta.default_branch)}?recursive=1`),
    gh<string>(`${base}/readme`, true).catch(() => ""),
  ]);

  const files = tree.tree.filter((t) => t.type === "blob").map((t) => t.path);
  const fileSet = new Set(files);

  const manifestPaths = MANIFESTS.filter((m) => fileSet.has(m));
  const sourcePaths = tree.tree
    .filter((t) => t.type === "blob" && SOURCE_EXT.test(t.path) && !SKIP_DIR.test(t.path))
    // shallow + entry-point-ish files first
    .sort((a, b) => score(a.path) - score(b.path))
    .map((t) => t.path);

  const readFile = (p: string) =>
    gh<string>(`${base}/contents/${p.split("/").map(encodeURIComponent).join("/")}`, true).catch(() => "");

  const manifests = await Promise.all(manifestPaths.map(async (p) => [p, await readFile(p)] as const));

  const sources: [string, string][] = [];
  let used = 0;
  for (const p of sourcePaths.slice(0, 20)) {
    if (used >= FILE_BUDGET) break;
    const body = (await readFile(p)).slice(0, PER_FILE);
    if (!body) continue;
    sources.push([p, body]);
    used += body.length;
  }

  const langTotal = Object.values(languages).reduce((a, b) => a + b, 0) || 1;
  const langLine = Object.entries(languages)
    .map(([l, n]) => `${l} ${((n / langTotal) * 100).toFixed(1)}%`)
    .join(", ");

  const parts = [
    `# Repository: ${meta.full_name}`,
    `URL: ${meta.html_url}`,
    `Current description: ${meta.description ?? "(none)"}`,
    `Homepage: ${meta.homepage || "(none)"}`,
    `Stars: ${meta.stargazers_count}, Forks: ${meta.forks_count}`,
    `License: ${meta.license?.spdx_id ?? "(none)"}`,
    `Current topics: ${meta.topics.join(", ") || "(none)"}`,
    `Languages: ${langLine || "(unknown)"}`,
    "",
    `## File tree (${files.length} files${files.length > TREE_LIMIT || tree.truncated ? ", truncated" : ""})`,
    files.slice(0, TREE_LIMIT).join("\n"),
    "",
    "## Existing README",
    readme ? `<existing_readme>\n${readme.slice(0, 15_000)}\n</existing_readme>` : "(no README)",
    ...manifests.flatMap(([p, body]) => ["", `## ${p}`, "```", body.slice(0, 8_000), "```"]),
    ...sources.flatMap(([p, body]) => ["", `## ${p}`, "```", body, "```"]),
  ];

  return { meta, text: parts.join("\n") };
}

function score(path: string) {
  const depth = path.split("/").length;
  const entry = /(^|\/)(index|main|app|server|cli|lib|mod)\.\w+$/.test(path) ? -3 : 0;
  return depth + entry;
}
