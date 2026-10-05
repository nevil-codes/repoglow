import { describe, expect, it } from "vitest";
import type { RepoFacts } from "./github";
import { BADGES_TOKEN, buildBadges, finalizeReadme, slugify, TOC_TOKEN } from "./readme";

const facts: RepoFacts = {
  owner: "sindresorhus",
  repo: "is",
  url: "https://github.com/sindresorhus/is",
  license: "MIT",
  workflow: "main.yml",
  npm: "@sindresorhus/is",
  pypi: null,
  crate: null,
  dependencies: [],
  tooling: {},
};

const badge = (label: string, url: string) => ({ label, markdown: `![${label}](${url})` });
const finalize = (md: string, opts: Partial<Parameters<typeof finalizeReadme>[1]> = {}) =>
  finalizeReadme(md, { badges: null, toc: false, name: "my-tool", ...opts });

describe("finalizeReadme — model mistakes", () => {
  it("unwraps a README the model wrapped in a ```markdown fence", () => {
    const out = finalize("```markdown\n# Title\n\nBody\n```");
    expect(out).toBe("# Title\n\nBody\n");
  });

  it("strips an opening fence while the README is still streaming", () => {
    expect(finalize("```markdown\n# Title\n\nPartial")).toBe("# Title\n\nPartial\n");
  });

  it("does not unwrap a README that legitimately starts with a non-markdown code block", () => {
    const md = "```bash\nnpm i\n```\n\n# Title";
    expect(finalize(md)).toContain("```bash");
  });

  it('fixes "# <div align=center>Title" and drops the orphaned </div>', () => {
    const out = finalize('# <div align="center">Download Sorter 🚀\n\n> tagline\n\n</div>\n\n## Usage');
    expect(out).toMatch(/^# Download Sorter 🚀$/m);
    expect(out).not.toMatch(/<\/?div/);
  });

  it("keeps balanced hero divs intact", () => {
    const out = finalize('<div align="center">\n\n# Title\n\n</div>\n\n## A');
    expect(out).toContain('<div align="center">');
    expect(out).toContain("</div>");
  });

  it("removes invented local badge images and the empty table they leave behind", () => {
    const md = "# Title\n\n| | |\n|---|---|\n| ![npm](/badges/npm-version.svg) | ![dl](/badges/downloads.svg) |\n\n## Why";
    const out = finalize(md);
    expect(out).not.toContain("/badges/");
    expect(out).not.toMatch(/^\|/m);
  });

  it("removes multi-line <a><img shields></a> badge links without leaving empty tags", () => {
    const md = [
      '<div align="center">',
      '  <a href="https://npmjs.com/x">',
      '    <img src="https://img.shields.io/npm/v/x?style=for-the-badge" alt="npm">',
      "  </a>",
      '  <a href="#usage">Usage</a>',
      "</div>",
    ].join("\n");
    const out = finalize(md);
    expect(out).not.toContain("shields.io");
    expect(out).not.toMatch(/<a[^>]*>\s*<\/a>/);
    expect(out).toContain('<a href="#usage">Usage</a>');
  });

  it("drops model badge lines that contain <owner>/<repo> placeholders", () => {
    const md = '# T\n\n<a href="#"><img src="https://img.shields.io/github/license/<owner>/<repo>?style=x" alt="L" /></a>\n\nText';
    expect(finalize(md)).not.toContain("<owner>");
  });

  it("replaces <owner>/<repo> with the real slug for repos", () => {
    const out = finalize("[Bug](https://github.com/<owner>/<repo>/issues)", { facts });
    expect(out).toContain("https://github.com/sindresorhus/is/issues");
  });

  it("replaces <owner>/<repo> with a visible placeholder for ideas (raw <owner> renders as an invisible tag)", () => {
    const out = finalize("[Bug](https://github.com/<owner>/<repo>/issues)", { name: "file-sortie" });
    expect(out).toContain("https://github.com/your-username/file-sortie/issues");
  });
});

describe("finalizeReadme — badges", () => {
  const badges = [badge("npm", "https://img.shields.io/npm/v/x")];

  it("fills the badges token", () => {
    const out = finalize(`# T\n\n${BADGES_TOKEN}\n\nBody`, { badges });
    expect(out).toContain("![npm](https://img.shields.io/npm/v/x)");
    expect(out).not.toContain(BADGES_TOKEN);
  });

  it("inserts badges after the title and tagline when the model forgot the token", () => {
    const out = finalize("# T\n\n> tagline\n\nBody", { badges });
    expect(out.indexOf("> tagline")).toBeLessThan(out.indexOf("![npm]"));
    expect(out.indexOf("![npm]")).toBeLessThan(out.indexOf("Body"));
  });

  it("removes the token when badges are turned off", () => {
    expect(finalize(`# T\n\n${BADGES_TOKEN}\n\nBody`)).not.toContain(BADGES_TOKEN);
  });

  it("replaces model-written badge rows with the real ones", () => {
    const md = "# T\n\n![fake](https://img.shields.io/npm/v/wrong-name)\n\nBody";
    const out = finalize(md, { badges });
    expect(out).not.toContain("wrong-name");
    expect(out).toContain("npm/v/x");
  });
});

describe("finalizeReadme — table of contents", () => {
  const md = `# T\n\nIntro\n\n${TOC_TOKEN}\n\n## ✨ Features\n\n## Getting Started\n\n\`\`\`md\n## Not a heading\n\`\`\`\n\n## Usage\n\n## Usage`;

  it("builds a collapsible TOC from H2s with GitHub anchors, skipping code blocks", () => {
    const out = finalize(md, { toc: true });
    expect(out).toContain("<summary><b>Table of contents</b></summary>");
    expect(out).toContain("- [✨ Features](#-features)");
    expect(out).toContain("- [Getting Started](#getting-started)");
    expect(out).not.toContain("Not a heading](");
  });

  it("de-duplicates repeated anchors like GitHub (-1 suffix)", () => {
    const out = finalize(md, { toc: true });
    expect(out).toContain("(#usage)");
    expect(out).toContain("(#usage-1)");
  });

  it("removes the token when TOC is off", () => {
    expect(finalize(md)).not.toContain(TOC_TOKEN);
    expect(finalize(md)).not.toContain("Table of contents");
  });

  it("skips the TOC for short READMEs (fewer than 3 sections)", () => {
    expect(finalize(`# T\n\n${TOC_TOKEN}\n\n## A\n\n## B`, { toc: true })).not.toContain("Table of contents");
  });

  it("unwraps the token when the model nested it in its own <details> (rendered as an unlabeled box)", () => {
    const out = finalize(`# T\n\n<details>\n${TOC_TOKEN}\n</details>\n\n## A\n\n## B\n\n## C`, { toc: true });
    expect(out.match(/<details>/g)).toHaveLength(1);
    expect(out).toContain("<summary>");
  });

  it("replaces a TOC the model wrote itself", () => {
    const out = finalize("# T\n\n## 📑 Table of Contents\n\n- [A](#a)\n- [B](#b)\n\n## A\n\n## B\n\n## C", { toc: true });
    expect(out.match(/Table of contents/gi)).toHaveLength(1);
    expect(out).toContain("<details>");
  });
});

describe("slugify", () => {
  it.each([
    ["Getting Started", "getting-started"],
    ["✨ Why is?", "-why-is"],
    ["Why `is`?", "why-is"],
    ["🛠️ Tech Stack", "-tech-stack"],
    ["[Docs](https://x.y) & API", "docs--api"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("buildBadges", () => {
  it("builds badges from real repo facts", () => {
    const labels = buildBadges(facts, []).map((b) => b.label);
    expect(labels).toEqual(["npm version", "npm downloads", "CI status", "License", "GitHub stars", "Last commit"]);
  });

  it("links PyPI and crates.io when present", () => {
    const md = buildBadges({ ...facts, npm: null, pypi: "typer", crate: "bat" }, [])
      .map((b) => b.markdown)
      .join(" ");
    expect(md).toContain("pypi.org/project/typer");
    expect(md).toContain("crates.io/crates/bat");
  });

  it("keeps static model badges and normalizes their style", () => {
    const [b] = buildBadges(undefined, [badge("TS", "https://img.shields.io/badge/TypeScript-blue?style=flat&logo=typescript")]);
    expect(b.markdown).toBe("![TS](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript)");
  });

  it("adds the style param when missing", () => {
    const [b] = buildBadges(undefined, [badge("Node", "https://img.shields.io/badge/node-%3E%3D22-green.svg")], '"node": ">=22"');
    expect(b.markdown).toContain("green.svg?style=for-the-badge");
  });

  it("drops dynamic and placeholder model badges", () => {
    const out = buildBadges(undefined, [
      badge("npm", "https://img.shields.io/npm/v/whatever"),
      badge("x", "https://img.shields.io/badge/<owner>-blue"),
    ]);
    expect(out).toEqual([]);
  });

  it("drops model badges that duplicate real ones (license, stars...) when repo facts exist", () => {
    const model = [badge("License: MIT", "https://img.shields.io/badge/License-MIT-a855f7"), badge("Next.js", "https://img.shields.io/badge/Next.js-black")];
    expect(buildBadges(facts, model).map((b) => b.label)).not.toContain("License: MIT");
    expect(buildBadges(undefined, model).map((b) => b.label)).toContain("License: MIT");
  });

  it("always drops static build/CI/coverage badges — a static badge can't know status", () => {
    expect(buildBadges(undefined, [badge("Build", "https://img.shields.io/badge/build-passing-green")])).toEqual([]);
  });

  it("keeps version badges backed by the manifests and drops invented ones", () => {
    const evidence = '{"devDependencies":{"typescript":"6.0.2"},"engines":{"node":">=22"}}';
    const out = buildBadges(
      undefined,
      [
        badge("TS ok", "https://img.shields.io/badge/typescript-6.x-blue.svg"),
        badge("Node ok", "https://img.shields.io/badge/node-%3E%3D22-green.svg"),
        badge("TS fake", "https://img.shields.io/badge/TypeScript-3.9.7-blue"),
        badge("npm fake", "https://img.shields.io/badge/npm-9.5.1%2B-red"),
        badge("No version", "https://img.shields.io/badge/Made_with-TypeScript-blue"),
      ],
      evidence,
    ).map((b) => b.label);
    expect(out).toEqual(["TS ok", "Node ok", "No version"]);
  });

  it("caps the badge row at 10", () => {
    const many = Array.from({ length: 15 }, (_, i) => badge(`b${i}`, `https://img.shields.io/badge/tool${String.fromCharCode(97 + i)}-blue`));
    expect(buildBadges(facts, many)).toHaveLength(10);
  });
});
