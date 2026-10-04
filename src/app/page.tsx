"use client";

import { useEffect, useRef, useState } from "react";
import type { PolishMeta, Tone } from "@/lib/schema";
import type { GenerateEvent, RepoInfo, Stage } from "@/lib/events";
import { Results } from "@/components/Results";
import { Card, Icon, ThemeToggle } from "@/components/ui";

type Mode = "repo" | "idea";
type Result = { meta: PolishMeta; readme: string; repo: RepoInfo | null; done: boolean };

const TONES: { id: Tone; label: string; emoji: string }[] = [
  { id: "professional", label: "Professional", emoji: "💼" },
  { id: "playful", label: "Playful", emoji: "🎉" },
  { id: "minimal", label: "Minimal", emoji: "◽" },
  { id: "bold", label: "Bold", emoji: "🔥" },
];

const OPTIONS = [
  { id: "badges", label: "Badges" },
  { id: "emojis", label: "Emoji headings" },
  { id: "toc", label: "Table of contents" },
  { id: "diagram", label: "Mermaid diagram" },
] as const;
type OptionId = (typeof OPTIONS)[number]["id"];

const STEPS: Record<Mode, { stage: Stage; label: string }[]> = {
  repo: [
    { stage: "digest", label: "Reading repo tree, manifests & source" },
    { stage: "meta", label: "Picking names, topics, badges & packages" },
    { stage: "readme", label: "Writing README" },
  ],
  idea: [
    { stage: "meta", label: "Brainstorming names, topics & packages" },
    { stage: "readme", label: "Writing README" },
  ],
};

const EXAMPLES = {
  repo: ["https://github.com/sindresorhus/is", "https://github.com/tj/commander.js"],
  idea: [
    "A CLI that watches my Downloads folder and auto-sorts files into folders by type and date. Written in Go.",
    "React Native habit tracker with streaks, reminders and offline sync using SQLite.",
  ],
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("repo");
  const [repoUrl, setRepoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [opts, setOpts] = useState<Record<OptionId, boolean>>({ badges: true, emojis: true, toc: true, diagram: true });
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Result | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [loading]);

  const steps = STEPS[mode];
  const step = Math.max(0, steps.findIndex((s) => s.stage === stage));
  const elapsed = loading && now > startedAt ? Math.round((now - startedAt) / 1000) : 0;

  const canSubmit = mode === "repo" ? repoUrl.trim().length > 0 : description.trim().length >= 10;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setStage(null);
    setError(null);
    setData(null);
    setStartedAt(Date.now());
    setNow(Date.now());

    let repo: RepoInfo | null = null;
    const handle = (ev: GenerateEvent) => {
      switch (ev.type) {
        case "stage":
          setStage(ev.stage);
          break;
        case "repo":
          repo = ev.repo;
          break;
        case "meta":
          setData({ meta: ev.meta, readme: "", repo, done: false });
          break;
        case "readme":
          setData((d) => (d ? { ...d, readme: ev.markdown } : d));
          break;
        case "done":
          setData((d) => ({ meta: ev.polish, readme: ev.polish.readme, repo: d?.repo ?? repo, done: true }));
          break;
        case "error":
          throw new Error(ev.error);
      }
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, repoUrl, description, tone, options: opts }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }
      // NDJSON: one event per line; a chunk can end mid-line.
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line));
      }
      if (buffer.trim()) handle(JSON.parse(buffer));
    } catch (err) {
      if (controller.signal.aborted) setError("Cancelled.");
      else setError(err instanceof Error ? err.message : "Something went wrong");
      setData((d) => (d ? { ...d, done: true } : d));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="size-8" />
          <span className="text-lg font-bold tracking-tight">RepoGlow</span>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://github.com/nevil-codes/repoglow" target="_blank" rel="noreferrer"
            className="grid size-9 place-items-center rounded-xl border border-card-border bg-card text-muted backdrop-blur transition hover:text-fg"
            aria-label="GitHub">
            <Icon.github className="size-4" />
          </a>
          <ThemeToggle />
        </div>
      </header>

      <section className="pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-card px-3 py-1 text-xs font-medium text-muted backdrop-blur">
          <Icon.sparkle className="size-3 text-accent-2" /> Runs on local AI · Ollama
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
          Make your repo <span className="text-gradient">impossible to scroll past</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted sm:text-lg">
          Drop a GitHub link or describe your idea. Get a stunning README, catchy names, the perfect About blurb,
          topics, badges and package picks — in one click.
        </p>
      </section>

      <Card className="mx-auto mt-10 max-w-3xl p-4 sm:p-6">
        <form onSubmit={generate}>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-card-border bg-input p-1">
            {([["repo", "GitHub repo", Icon.github], ["idea", "Describe idea", Icon.bulb]] as const).map(([m, label, I]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
                  mode === m ? "bg-card shadow-sm ring-1 ring-card-border" : "text-muted hover:text-fg"
                }`}>
                <I className="size-4" /> {label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {mode === "repo" ? (
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo"
                autoFocus spellCheck={false}
                className="w-full rounded-xl border border-card-border bg-input px-4 py-3.5 font-mono text-sm outline-none transition placeholder:text-muted/60 focus:border-accent-1 focus:ring-4 focus:ring-accent-1/15" />
            ) : (
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={5000}
                placeholder="What does it do? Who is it for? Stack, key features, anything that makes it special…"
                className="w-full resize-y rounded-xl border border-card-border bg-input px-4 py-3 text-sm outline-none transition placeholder:text-muted/60 focus:border-accent-1 focus:ring-4 focus:ring-accent-1/15" />
            )}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>Try:</span>
              {EXAMPLES[mode].map((ex) => (
                <button key={ex} type="button" className="max-w-full truncate underline-offset-2 hover:text-fg hover:underline"
                  onClick={() => (mode === "repo" ? setRepoUrl(ex) : setDescription(ex))}>
                  {mode === "repo" ? ex.replace("https://github.com/", "") : ex.slice(0, 48) + "…"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Tone</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTone(t.id)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ring-1 ${
                      tone === t.id ? "bg-accent-1/15 ring-accent-1/60 text-fg" : "ring-card-border text-muted hover:text-fg"
                    }`}>
                    <span className="mr-1">{t.emoji}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">README extras</p>
              <div className="flex flex-wrap gap-2">
                {OPTIONS.map((o) => (
                  <button key={o.id} type="button" aria-pressed={opts[o.id]}
                    onClick={() => setOpts((s) => ({ ...s, [o.id]: !s[o.id] }))}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ring-1 ${
                      opts[o.id] ? "bg-accent-3/15 ring-accent-3/60 text-fg" : "ring-card-border text-muted hover:text-fg"
                    }`}>
                    {opts[o.id] && <Icon.check className="size-3.5" />}{o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" disabled={!canSubmit || loading}
            className="btn-glow relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-3.5 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {loading && <span className="shimmer absolute inset-0" />}
            <Icon.sparkle className={`size-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? `${steps[step].label}… ${elapsed}s` : "Generate polish kit"}
          </button>
        </form>

        {loading && (
          <ol className="mt-4 grid gap-1.5 text-sm">
            {steps.map(({ label: s }, i) => (
              <li key={s} className={`flex items-center gap-2 transition ${i <= step ? "text-fg" : "text-muted/50"}`}>
                {i < step ? <Icon.check className="size-4 text-emerald-500" />
                  : i === step ? <span className="size-4 grid place-items-center"><span className="size-2 animate-ping rounded-full bg-accent-2" /></span>
                  : <span className="size-4 grid place-items-center"><span className="size-1.5 rounded-full bg-current" /></span>}
                {s}
              </li>
            ))}
            <li className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
              <span>Runs on your machine — usually 1–3 minutes. Results appear as soon as they&apos;re ready.</span>
              <button type="button" onClick={() => abortRef.current?.abort()}
                className="rounded-lg border border-card-border px-2.5 py-1 font-medium transition hover:border-red-500/50 hover:text-red-500">
                Cancel
              </button>
            </li>
          </ol>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}
      </Card>

      {data && <Results key={startedAt} polish={{ ...data.meta, readme: data.readme }} repoName={data.repo?.fullName} streaming={!data.done} />}

      {!data && !loading && (
        <section className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            ["📝", "README that sells", "Hero, badges, features, quickstart, diagrams — built from your actual code."],
            ["🏷️", "Names, About & topics", "Discoverable topics and a crisp About line so people find and star it."],
            ["📦", "Packages & quick wins", "Stack-aware package picks and a checklist to level up your repo."],
          ].map(([e, t, d]) => (
            <Card key={t} className="p-5">
              <div className="text-2xl">{e}</div>
              <p className="mt-2 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </Card>
          ))}
        </section>
      )}

      <footer className="mt-20 text-center text-xs text-muted">
        Built with Next.js & Ollama · Repos are read via the public GitHub API; generation runs locally and nothing is stored.
      </footer>
    </main>
  );
}
