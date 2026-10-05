import { describe, expect, it } from "vitest";
import { describeTooling, detectTooling, filterPackages, parseDependencies } from "./stack";

describe("parseDependencies", () => {
  it("reads all package.json dependency fields", () => {
    const pkg = JSON.stringify({
      dependencies: { react: "^19" },
      devDependencies: { xo: "^1", typescript: "6.0.2" },
      peerDependencies: { "react-dom": "*" },
      optionalDependencies: { fsevents: "*" },
    });
    expect(parseDependencies([["package.json", pkg]]).sort()).toEqual(["fsevents", "react", "react-dom", "typescript", "xo"]);
  });

  it("detects built-in test runners from package.json scripts", () => {
    const pkg = (test: string) => JSON.stringify({ scripts: { test } });
    expect(parseDependencies([["package.json", pkg("xo && node --experimental-transform-types --test test/test.ts")]])).toContain("node:test");
    expect(parseDependencies([["package.json", pkg("bun test")]])).toContain("bun:test");
  });

  it("ignores invalid package.json", () => {
    expect(parseDependencies([["package.json", "{ nope"]])).toEqual([]);
  });

  it("reads requirements.txt", () => {
    const txt = "# comment\nrequests>=2.0\nDjango==5.1\n\n-e .\n";
    expect(parseDependencies([["requirements.txt", txt]])).toEqual(["requests", "django"]);
  });

  it("reads pyproject.toml (PEP 621, optional deps, dependency groups) without project metadata noise", () => {
    const toml = `
[build-system]
requires = ["pdm-backend"]

[project]
name = "typer"
license = "MIT"
readme = "README.md"
dependencies = [
  "click >= 8.0.0",
  "rich>=10.11.0; python_version < '3.12'",
  "shellingham[extra]>=1.3.0",
]

[project.optional-dependencies]
standard = ["colorama>=0.4"]

[dependency-groups]
tests = ["pytest>=4.4", "coverage[toml]"]
dev = [{ include-group = "tests" }, "ruff"]
`;
    const deps = parseDependencies([["pyproject.toml", toml]], "typer").sort();
    expect(deps).toEqual(["click", "colorama", "coverage", "pytest", "rich", "ruff", "shellingham"]);
  });

  it("reads Poetry dependency tables and skips python", () => {
    const toml = `
[tool.poetry.dependencies]
python = "^3.10"
fastapi = "^0.110"

[tool.poetry.group.dev.dependencies]
pytest = { version = "^8" }
`;
    expect(parseDependencies([["pyproject.toml", toml]]).sort()).toEqual(["fastapi", "pytest"]);
  });

  it("reads Cargo.toml including [dependencies.x] tables and workspace deps", () => {
    const toml = `
[package]
name = "bat"
edition = "2021"

[dependencies]
nu-ansi-term = "0.50"
serde = { version = "1", features = ["derive"] }

[dependencies.clap]
version = "4"

[dev-dependencies]
assert_cmd = "2"

[workspace.dependencies]
tokio = "1"
`;
    expect(parseDependencies([["Cargo.toml", toml]], "bat").sort()).toEqual(["assert_cmd", "clap", "nu-ansi-term", "serde", "tokio"]);
  });

  it("reads go.mod require blocks and single-line requires", () => {
    const mod = `module github.com/spf13/cobra

go 1.15

require github.com/inconshreveable/mousetrap v1.1.0

require (
\tgithub.com/spf13/pflag v1.0.6
\tgo.yaml.in/yaml/v3 v3.0.3 // indirect
)
`;
    expect(parseDependencies([["go.mod", mod]]).sort()).toEqual([
      "github.com/inconshreveable/mousetrap",
      "github.com/spf13/pflag",
      "go.yaml.in/yaml/v3",
    ]);
  });

  it("reads Gemfile and composer.json", () => {
    expect(parseDependencies([["Gemfile", "source 'x'\ngem 'rails', '~> 7'\n  gem \"rspec\"\n"]]).sort()).toEqual(["rails", "rspec"]);
    const composer = JSON.stringify({ require: { "laravel/framework": "^11" }, "require-dev": { "phpunit/phpunit": "^11" } });
    expect(parseDependencies([["composer.json", composer]]).sort()).toEqual(["laravel/framework", "phpunit/phpunit"]);
  });
});

describe("detectTooling", () => {
  it("maps dependencies to roles", () => {
    expect(detectTooling(["node:test", "xo", "rxjs"])).toEqual({ "test runner": "node:test", linter: "xo" });
    expect(detectTooling(["pytest", "ruff"])).toEqual({ "test runner": "pytest", linter: "ruff", formatter: "ruff" });
    expect(detectTooling(["clap"])).toEqual({ "CLI framework": "clap" });
  });

  it("describes tooling for the prompt", () => {
    expect(describeTooling({ "test runner": "ava" })).toBe("test runner: ava");
    expect(describeTooling({})).toBe("(none detected)");
  });
});

describe("filterPackages", () => {
  const deps = ["xo", "node:test", "typescript"];
  const tooling = detectTooling(deps);
  const names = (pkgs: { name: string }[]) => filterPackages(pkgs, deps, tooling).map((p) => p.name);

  it("drops packages already installed", () => {
    expect(names([{ name: "typescript" }, { name: "np" }])).toEqual(["np"]);
  });

  it("drops packages that would replace existing tooling (jest when node:test is used)", () => {
    expect(names([{ name: "jest" }, { name: "vitest" }, { name: "eslint" }, { name: "prettier" }])).toEqual(["prettier"]);
  });

  it("normalizes install-command style names and version suffixes", () => {
    expect(names([{ name: "npm install xo" }, { name: "typescript@5" }, { name: "Husky" }])).toEqual(["Husky"]);
  });
});
