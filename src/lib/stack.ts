// Deterministic stack detection from manifests, used to keep the model from
// suggesting packages a project already has or replacing tooling it already uses.

type Manifests = ReadonlyArray<readonly [path: string, body: string]>;

/** Lowercased dependency names declared in the repo's manifests. */
export function parseDependencies(manifests: Manifests, selfName?: string | null): string[] {
  const deps = new Set<string>();
  const add = (name: string | undefined) => {
    const n = name?.trim().toLowerCase();
    if (n) deps.add(n);
  };

  for (const [path, body] of manifests) {
    if (path === "package.json") {
      try {
        const pkg = JSON.parse(body);
        for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
          Object.keys(pkg[key] ?? {}).forEach(add);
        }
        // Built-in runners have no package to declare.
        const scripts = Object.values(pkg.scripts ?? {}).join(" ");
        if (/\bnode\s+(--[\w-]+\s+)*--test\b/.test(scripts)) add("node:test");
        if (/\bbun\s+test\b/.test(scripts)) add("bun:test");
        if (/\bdeno\s+test\b/.test(scripts)) add("deno test");
      } catch {}
    } else if (path === "requirements.txt") {
      // Skip options like -e / -r / --index-url; names start with a letter or digit.
      body.split("\n").forEach((l) => add(l.match(/^\s*([A-Za-z0-9][A-Za-z0-9_.-]*)/)?.[1]));
    } else if (path === "pyproject.toml") {
      for (const [header, content] of tomlSections(body)) {
        // PEP 621 `dependencies = [...]` inside [project]; every list in optional-dependencies / dependency-groups.
        if (header === "project") {
          // The list ends at a "]" closing a line — not at the "]" of an extra like "pkg[extra]>=1".
          const list = content.match(/^dependencies\s*=\s*\[([\s\S]*?)\]\s*$/m)?.[1] ?? "";
          pep508(list).forEach(add);
        } else if (header === "project.optional-dependencies" || header === "dependency-groups") {
          pep508(content.replace(/\{\s*include-group\s*=\s*["'][^"']*["']\s*\}/g, "")).forEach(add);
        } else if (/^tool\.poetry\.(group\.[^.]+\.)?(dev-)?dependencies$/.test(header)) {
          for (const m of content.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=/gm)) if (m[1] !== "python") add(m[1]);
        }
      }
    } else if (path === "Cargo.toml") {
      for (const [header, content] of tomlSections(body)) {
        if (/^(workspace\.)?(dev-|build-)?dependencies$/.test(header)) {
          for (const m of content.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)) add(m[1]);
        }
        // [dependencies.clap] table form
        add(header.match(/^(?:workspace\.)?(?:dev-|build-)?dependencies\.([A-Za-z0-9_-]+)$/)?.[1]);
      }
    } else if (path === "go.mod") {
      for (const m of body.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]{2,}\/[^\s]+)\s+v/gm)) add(m[1]);
    } else if (path === "Gemfile") {
      for (const m of body.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)) add(m[1]);
    } else if (path === "composer.json") {
      try {
        const c = JSON.parse(body);
        Object.keys({ ...c.require, ...c["require-dev"] }).forEach(add);
      } catch {}
    }
  }
  if (selfName) deps.delete(selfName.toLowerCase());
  return [...deps];
}

/** [header, body] pairs of a TOML file (enough for manifest dependency tables). */
function tomlSections(body: string): [string, string][] {
  const out: [string, string][] = [];
  const re = /^\[([^\]\n]+)\]\s*$/gm;
  const heads = [...body.matchAll(re)];
  heads.forEach((h, i) => {
    const start = h.index! + h[0].length;
    const end = heads[i + 1]?.index ?? body.length;
    out.push([h[1].trim(), body.slice(start, end)]);
  });
  return out;
}

/** Package names from quoted PEP 508 requirement strings, e.g. "rich>=10; python_version<'3.12'". */
function pep508(text: string): string[] {
  return [...text.matchAll(/["']\s*([A-Za-z0-9][A-Za-z0-9_.-]*)\s*(?:\[[^\]]*\])?\s*(?:[<>=!~;@ ][^"']*)?["']/g)].map((m) => m[1]);
}

// Packages that fill the same role; suggesting a second one is churn, not polish.
const CATEGORIES: Record<string, string[]> = {
  "test runner": ["jest", "vitest", "mocha", "ava", "tap", "jasmine", "uvu", "node:test", "bun:test", "deno test", "pytest", "nose2", "@playwright/test", "cypress"],
  linter: ["eslint", "xo", "@biomejs/biome", "standard", "oxlint", "ruff", "flake8", "pylint", "golangci-lint", "rubocop"],
  formatter: ["prettier", "@biomejs/biome", "dprint", "black", "ruff", "autopep8", "yapf"],
  bundler: ["webpack", "vite", "rollup", "esbuild", "parcel", "tsup", "@rspack/core", "turbopack"],
  "web framework": ["next", "nuxt", "@sveltejs/kit", "remix", "@remix-run/react", "astro", "gatsby", "django", "flask", "fastapi", "express", "fastify", "koa", "hono", "@nestjs/core", "github.com/gin-gonic/gin", "github.com/labstack/echo/v4", "github.com/gofiber/fiber/v2", "actix-web", "axum", "rocket", "rails", "sinatra"],
  "git hooks": ["husky", "lefthook", "simple-git-hooks", "pre-commit"],
  "CLI framework": ["commander", "yargs", "cac", "meow", "oclif", "click", "typer", "argparse", "github.com/spf13/cobra", "github.com/urfave/cli/v2", "clap"],
  logger: ["winston", "pino", "bunyan", "loguru", "github.com/sirupsen/logrus", "go.uber.org/zap", "github.com/rs/zerolog", "tracing", "log"],
};

/** Roles the project already covers, e.g. { "test runner": "ava", linter: "xo" }. */
export function detectTooling(deps: string[]): Record<string, string> {
  const have = new Set(deps);
  const found: Record<string, string> = {};
  for (const [role, names] of Object.entries(CATEGORIES)) {
    const hit = names.find((n) => have.has(n));
    if (hit) found[role] = hit;
  }
  return found;
}

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/^(npm|pip|cargo|go)\s+(install|add|get)\s+/, "")
    .replace(/@[\d^~>=<.x*]+$/, "");

/** Drop suggestions the project already depends on or that replace tooling it already has. */
export function filterPackages<T extends { name: string }>(packages: T[], deps: string[], tooling: Record<string, string>): T[] {
  const have = new Set(deps);
  const taken = new Set(Object.keys(tooling));
  return packages.filter((p) => {
    const name = normalizeName(p.name);
    if (have.has(name)) return false;
    const role = Object.entries(CATEGORIES).find(([, names]) => names.includes(name))?.[0];
    return !(role && taken.has(role));
  });
}

/** One line for the prompt so the model knows what's already in place. */
export function describeTooling(tooling: Record<string, string>): string {
  const entries = Object.entries(tooling);
  return entries.length ? entries.map(([role, name]) => `${role}: ${name}`).join(", ") : "(none detected)";
}
