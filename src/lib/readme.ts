import type { RepoFacts } from "./github";
import type { RepoPolish } from "./schema";

// Tokens the model is asked to leave in the README; filled in here so badges
// and the table of contents are always correct.
export const BADGES_TOKEN = "{{BADGES}}";
export const TOC_TOKEN = "{{TOC}}";

const STYLE = "style=for-the-badge";

/**
 * Badges derived from real repo facts, plus the model's static tech-stack badges.
 * `evidence` (manifests, or the idea text) must back up any version a model badge claims.
 */
export function buildBadges(facts: RepoFacts | undefined, modelBadges: RepoPolish["badges"], evidence = ""): RepoPolish["badges"] {
  const out: RepoPolish["badges"] = [];
  if (facts) {
    const slug = `${facts.owner}/${facts.repo}`;
    if (facts.npm) {
      out.push({ label: "npm version", markdown: `[![npm](https://img.shields.io/npm/v/${facts.npm}?${STYLE})](https://www.npmjs.com/package/${facts.npm})` });
      out.push({ label: "npm downloads", markdown: `[![downloads](https://img.shields.io/npm/dm/${facts.npm}?${STYLE})](https://www.npmjs.com/package/${facts.npm})` });
    }
    if (facts.pypi) out.push({ label: "PyPI version", markdown: `[![PyPI](https://img.shields.io/pypi/v/${facts.pypi}?${STYLE})](https://pypi.org/project/${facts.pypi}/)` });
    if (facts.crate) out.push({ label: "crates.io", markdown: `[![crates.io](https://img.shields.io/crates/v/${facts.crate}?${STYLE})](https://crates.io/crates/${facts.crate})` });
    if (facts.workflow) {
      out.push({ label: "CI status", markdown: `[![CI](https://img.shields.io/github/actions/workflow/status/${slug}/${facts.workflow}?${STYLE}&label=CI)](${facts.url}/actions/workflows/${facts.workflow})` });
    }
    if (facts.license) out.push({ label: "License", markdown: `[![License](https://img.shields.io/github/license/${slug}?${STYLE})](${facts.url}/blob/HEAD/LICENSE)` });
    out.push({ label: "GitHub stars", markdown: `[![Stars](https://img.shields.io/github/stars/${slug}?${STYLE})](${facts.url}/stargazers)` });
    out.push({ label: "Last commit", markdown: `[![Last commit](https://img.shields.io/github/last-commit/${slug}?${STYLE})](${facts.url}/commits)` });
  }

  // Keep only static shields.io badges from the model — dynamic ones need a real repo/package and are often invented.
  const seen = new Set(out.map((b) => b.label.toLowerCase()));
  for (const b of modelBadges) {
    const ok = /https:\/\/img\.shields\.io\/badge\//.test(b.markdown) && !/[<>]|your-|owner\/repo/i.test(b.markdown);
    if (!ok || seen.has(b.label.toLowerCase()) || !versionBacked(b.markdown, evidence)) continue;
    seen.add(b.label.toLowerCase());
    out.push({ label: b.label, markdown: b.markdown.replace(/\((https:\/\/img\.shields\.io\/badge\/[^)\s]+)\)/, (_, url: string) => `(${withStyle(url)})`) });
  }
  return out.slice(0, 10);
}

/** Fix the recurring formatting mistakes local models make, then fill tokens. */
export function finalizeReadme(
  raw: string,
  opts: { badges: RepoPolish["badges"] | null; toc: boolean; facts?: RepoFacts; name: string },
): string {
  let md = raw.trim();

  // Whole README wrapped in a code fence.
  const fenced = md.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fenced) md = fenced[1].trim();
  // ...or still being streamed, so the closing fence hasn't arrived yet.
  else md = md.replace(/^```(?:markdown|md)\s*\n/i, "");

  // "# <div align="center">Title" -> "# Title" (and drop the now-unmatched </div>).
  let removedDivs = 0;
  md = md.replace(/^(#{1,6})\s*<div[^>]*>\s*(.*)$/gm, (_, hashes: string, rest: string) => {
    removedDivs++;
    return rest ? `${hashes} ${rest}` : "";
  });
  for (; removedDivs > 0 && countOf(md, /<\/div>/g) > countOf(md, /<div\b/g); removedDivs--) {
    md = md.replace(/<\/div>/, "");
  }

  // Invented local badge images (e.g. /badges/npm.svg) and any model-written badge rows — real ones are inserted below.
  md = md
    .replace(/<a\s[^>]*>\s*<img\s[^>]*shields\.io[\s\S]*?<\/a>/g, "")
    .split("\n")
    .filter(
      (line) =>
        !/\]\(\/?badges\//.test(line) &&
        !(/shields\.io/.test(line) && /<owner>|<repo>|your-username/i.test(line)) &&
        !isBadgeOnlyLine(line),
    )
    .join("\n")
    // A table whose only rows were badges is now just an empty header + separator.
    .replace(/^\|[\s|]*\|\n\|[\s:|-]*\|\n(?!\|)/gm, "")
    // Wrappers left empty by the removals above.
    .replace(/<(a|p)\b[^>]*>\s*<\/\1>/g, "");

  // Real slug for repos; a visible placeholder for ideas (raw <owner> would render as an invisible HTML tag).
  const slug = opts.facts ? `${opts.facts.owner}/${opts.facts.repo}` : `your-username/${opts.name}`;
  md = md.replace(opts.facts ? /<owner>\/<repo>|your-username\/[\w.-]+|OWNER\/REPO/g : /<owner>\/<repo>|OWNER\/REPO/g, slug);

  // Badges
  const row = opts.badges?.length ? opts.badges.map((b) => b.markdown).join("\n") : "";
  if (md.includes(BADGES_TOKEN)) {
    md = md.replace(BADGES_TOKEN, row);
  } else if (row) {
    md = insertAfterTitle(md, row);
  }
  md = md.replaceAll(BADGES_TOKEN, "");

  // Table of contents. Unwrap the token if the model put it in its own <details> (renders as an unlabeled "Details" box).
  md = md.replace(/<details>\s*(?:<summary>[\s\S]*?<\/summary>)?\s*\{\{TOC\}\}\s*<\/details>/g, TOC_TOKEN);
  md = removeModelToc(md);
  if (opts.toc) {
    const toc = buildToc(md);
    if (md.includes(TOC_TOKEN)) md = md.replace(TOC_TOKEN, toc);
    else if (toc) md = insertBeforeFirstH2(md, toc);
  }
  md = md.replaceAll(TOC_TOKEN, "");

  return md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function countOf(s: string, re: RegExp) {
  return (s.match(re) ?? []).length;
}

function isBadgeOnlyLine(line: string) {
  const t = line.trim();
  if (!t) return false;
  const stripped = t
    .replace(/\[?!\[[^\]]*\]\([^)]*shields\.io[^)]*\)(\]\([^)]*\))?/g, "")
    .replace(/<a [^>]*>\s*<img [^>]*shields\.io[^>]*>\s*<\/a>/g, "")
    .replace(/<img [^>]*shields\.io[^>]*\/?>/g, "")
    .trim();
  return stripped === "" && t.length > 0 && /shields\.io/.test(t);
}

function insertAfterTitle(md: string, block: string) {
  const lines = md.split("\n");
  const h1 = lines.findIndex((l) => /^#\s|<h1/i.test(l.trim()));
  if (h1 === -1) return `${block}\n\n${md}`;
  // Skip a tagline right under the title (blockquote or bold line).
  let at = h1 + 1;
  while (at < lines.length && lines[at].trim() === "") at++;
  if (at < lines.length && /^(>|\*\*|<p)/.test(lines[at].trim())) at++;
  lines.splice(at, 0, "", block, "");
  return lines.join("\n");
}

function insertBeforeFirstH2(md: string, block: string) {
  const i = md.search(/^## /m);
  return i === -1 ? `${md}\n\n${block}` : `${md.slice(0, i)}${block}\n\n${md.slice(i)}`;
}

const TOC_HEADING = /^##\s+.*(table of contents|contents)\s*$/im;

function removeModelToc(md: string) {
  const m = md.match(TOC_HEADING);
  if (!m || m.index === undefined) return md;
  const rest = md.slice(m.index + m[0].length);
  const next = rest.search(/^#{1,2} /m);
  return md.slice(0, m.index) + (next === -1 ? "" : rest.slice(next));
}

/** GitHub's heading anchor algorithm (close enough for README headings). */
export function slugify(heading: string) {
  return heading
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function buildToc(md: string) {
  // Ignore headings inside fenced code blocks.
  const headings = md
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .filter((l) => /^##\s/.test(l))
    .map((l) => l.replace(/^##\s+/, "").trim());
  if (headings.length < 3) return "";
  const used = new Map<string, number>();
  const items = headings.map((h) => {
    const base = slugify(h);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const text = h.replace(/`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
    return `- [${text}](#${n ? `${base}-${n}` : base})`;
  });
  return `<details>\n<summary><b>Table of contents</b></summary>\n\n${items.join("\n")}\n\n</details>`;
}

/** A static badge like /badge/node-%3E%3D22-green claims "22"; keep it only if the evidence mentions that version. */
function versionBacked(markdown: string, evidence: string) {
  const path = markdown.match(/img\.shields\.io\/badge\/([^?)\s]+)/)?.[1];
  if (!path) return true;
  let text: string;
  try {
    text = decodeURIComponent(path.replace(/\.svg$/, "")).replace(/--/g, "\u0000").replace(/_/g, " ");
  } catch {
    return true;
  }
  // label-message-color (or message-color): the color is never a version, so drop it.
  const parts = text.split("-").map((s) => s.replace(/\u0000/g, "-"));
  const claim = parts.slice(0, -1).join(" ");
  const versions = claim.match(/\d+(?:\.[\dx*]+)*/g);
  if (!versions) return true;
  return versions.every((v) => {
    const major = v.split(".")[0];
    return new RegExp(`(^|[^\\d.])${major}(\\.|[^\\d]|$)`).test(evidence);
  });
}

function withStyle(url: string) {
  if (/[?&]style=/.test(url)) return url.replace(/style=[\w-]+/, STYLE);
  return `${url}${url.includes("?") ? "&" : "?"}${STYLE}`;
}
