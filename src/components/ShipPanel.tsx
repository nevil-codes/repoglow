"use client";

import { useEffect, useState } from "react";
import { Card, Icon } from "./ui";

type Status =
  | { state: "loading" }
  | { state: "unconfigured" }
  | { state: "error"; error: string }
  | { state: "ready"; login: string; canPush: boolean; canAdmin: boolean; archived: boolean };

type Action = { state: "idle" } | { state: "busy" } | { state: "done"; url?: string; note: string } | { state: "error"; error: string };

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

export function ShipPanel({
  repo,
  readme,
  aboutDescription,
  topics,
  disabled,
}: {
  repo: string;
  readme: string;
  aboutDescription: string;
  topics: string[];
  disabled: boolean;
}) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [pr, setPr] = useState<Action>({ state: "idle" });
  const [about, setAbout] = useState<Action>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/github/status?repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        if (!s.configured) setStatus({ state: "unconfigured" });
        else if (s.error) setStatus({ state: "error", error: s.error });
        else setStatus({ state: "ready", ...s });
      })
      .catch(() => !cancelled && setStatus({ state: "error", error: "Couldn't check GitHub access." }));
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const [owner, name] = repo.split("/");

  async function openPr() {
    setPr({ state: "busy" });
    try {
      const r = await post("/api/github/pr", { repo, readme, aboutDescription, topics });
      setPr({ state: "done", url: r.url, note: `PR #${r.number} opened${r.viaFork ? " from your fork" : ""}.` });
    } catch (e) {
      setPr({ state: "error", error: e instanceof Error ? e.message : "Failed" });
    }
  }

  async function applyAbout() {
    setAbout({ state: "busy" });
    try {
      await post("/api/github/about", { repo, aboutDescription, topics });
      setAbout({ state: "done", url: `https://github.com/${repo}`, note: "About description and topics updated." });
    } catch (e) {
      setAbout({ state: "error", error: e instanceof Error ? e.message : "Failed" });
    }
  }

  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Icon.github className="size-4" /> Ship it to GitHub
        </p>
        {status.state === "ready" && <span className="text-xs text-muted">as @{status.login}</span>}
      </div>

      {status.state === "loading" && <p className="mt-2 text-sm text-muted">Checking GitHub access…</p>}

      {status.state === "unconfigured" && (
        <div className="mt-2 space-y-2 text-sm text-muted">
          <p>Add a GitHub token to open a pull request with this README straight from here:</p>
          <pre className="overflow-x-auto rounded-lg border border-card-border bg-input px-3 py-2 font-mono text-xs text-fg">
            echo &quot;GITHUB_TOKEN=$(gh auth token)&quot; &gt;&gt; .env.local
          </pre>
          <p className="text-xs">Then restart the dev server. Or create a classic token with the <code>public_repo</code> scope.</p>
        </div>
      )}

      {status.state === "error" && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{status.error}</p>}

      {status.state === "ready" && (
        <>
          <p className="mt-2 text-sm text-muted">
            {status.archived
              ? "This repo is archived and can't receive pull requests."
              : status.canPush
                ? <>Opens a pull request on <b className="text-fg">{repo}</b> from a new <code>repoglow/readme-…</code> branch. Review it on GitHub before merging.</>
                : <>You can&apos;t push to <b className="text-fg">{repo}</b>, so RepoGlow will fork it to <b className="text-fg">{status.login}/{name}</b> and open the pull request from there.</>}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openPr}
              disabled={disabled || status.archived || pr.state === "busy" || pr.state === "done"}
              className="btn-glow inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon.github className="size-4" />
              {pr.state === "busy" ? "Opening pull request…" : pr.state === "done" ? "Pull request opened" : `Open PR on ${owner}/${name}`}
            </button>
            {status.canAdmin && (
              <button
                type="button"
                onClick={applyAbout}
                disabled={disabled || about.state === "busy" || about.state === "done"}
                className="inline-flex items-center gap-2 rounded-xl border border-card-border bg-input px-4 py-2 text-sm font-medium transition hover:border-accent-1/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {about.state === "busy" ? "Applying…" : about.state === "done" ? "About & topics applied" : "Apply About & topics"}
              </button>
            )}
          </div>
          {disabled && <p className="mt-2 text-xs text-muted">Available when generation finishes.</p>}
          {!status.canAdmin && !status.archived && (
            <p className="mt-2 text-xs text-muted">The suggested About and topics go in the PR description for a maintainer to apply.</p>
          )}
          <Outcome action={pr} />
          <Outcome action={about} />
        </>
      )}
    </Card>
  );
}

function Outcome({ action }: { action: Action }) {
  if (action.state === "done") {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-emerald-600 dark:text-emerald-300">
        <Icon.check className="size-4" /> {action.note}
        {action.url && (
          <a href={action.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
            View on GitHub →
          </a>
        )}
      </p>
    );
  }
  if (action.state === "error") return <p className="mt-3 text-sm text-red-600 dark:text-red-300">{action.error}</p>;
  return null;
}
