import { describe, expect, it } from "vitest";
import { GitHubError, parseRepo } from "./github";

describe("parseRepo", () => {
  it.each([
    "https://github.com/sindresorhus/is",
    "https://www.github.com/sindresorhus/is/",
    "http://github.com/sindresorhus/is.git",
    "git@github.com:sindresorhus/is.git",
    "sindresorhus/is",
    "  sindresorhus/is  ",
  ])("parses %s", (input) => {
    expect(parseRepo(input)).toEqual({ owner: "sindresorhus", repo: "is" });
  });

  it("keeps dots and dashes in names", () => {
    expect(parseRepo("https://github.com/tj/commander.js")).toEqual({ owner: "tj", repo: "commander.js" });
  });

  it.each(["", "nope", "https://gitlab.com/a/b c", "https://github.com/onlyowner"])("rejects %j", (input) => {
    expect(() => parseRepo(input)).toThrow(GitHubError);
  });
});
