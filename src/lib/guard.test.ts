import { afterEach, describe, expect, it } from "vitest";
import { guardWrite } from "./guard";

const post = (headers: Record<string, string>) => new Request("http://localhost:3000/api/github/pr", { method: "POST", headers });
const json = { "content-type": "application/json" };

describe("guardWrite", () => {
  afterEach(() => {
    delete process.env.REPOGLOW_ALLOW_REMOTE_WRITE;
  });

  it("allows same-origin JSON requests on localhost", () => {
    expect(guardWrite(post({ ...json, host: "localhost:3000", origin: "http://localhost:3000" }))).toBeNull();
    expect(guardWrite(post({ ...json, host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" }))).toBeNull();
  });

  it("blocks requests without an Origin header", () => {
    expect(guardWrite(post({ ...json, host: "localhost:3000" }))?.status).toBe(403);
  });

  it("blocks cross-site requests (CSRF)", () => {
    expect(guardWrite(post({ ...json, host: "localhost:3000", origin: "https://evil.example" }))?.status).toBe(403);
  });

  it("blocks non-JSON simple requests that would skip the CORS preflight", () => {
    const res = guardWrite(post({ "content-type": "text/plain", host: "localhost:3000", origin: "http://localhost:3000" }));
    expect(res?.status).toBe(415);
  });

  it("blocks LAN/remote hosts unless explicitly allowed", () => {
    const lan = () => post({ ...json, host: "192.168.1.5:3000", origin: "http://192.168.1.5:3000" });
    expect(guardWrite(lan())?.status).toBe(403);
    process.env.REPOGLOW_ALLOW_REMOTE_WRITE = "true";
    expect(guardWrite(lan())).toBeNull();
  });
});
