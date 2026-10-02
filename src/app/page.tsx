"use client";

import { useEffect, useState } from "react";
import type { RepoPolish, Tone } from "@/lib/schema";
import { Results } from "@/components/Results";
import { Card, Icon, ThemeToggle } from "@/components/ui";

type Mode = "repo" | "idea";
type Response = { polish: RepoPolish; repo: { fullName: string; url: string } | null };

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

const STEPS: Record<Mode, string[]> = {
  repo: ["Fetching repo tree", "Reading manifests & source", "Understanding the project", "Writing README", "Picking names, topics & badges"],
  idea: ["Understanding your idea", "Designing the README", "Brainstorming names", "Picking topics & packages"],
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
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Response | null>(null);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS[mode].length - 1)), 7000);
    return () => clearInterval(id);
  }, [loading, mode]);

  const canSubmit = mode === "repo" ? repoUrl.trim().length > 0 : description.trim().length >= 10;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setStep(0);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, repoUrl, description, tone, options: opts }),
      });
      const json = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
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
          <Icon.sparkle className="size-3 text-accent-2" /> Powered by Claude
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
            {loading ? STEPS[mode][step] + "…" : "Generate polish kit"}
          </button>
        </form>

        {loading && (
          <ol className="mt-4 grid gap-1.5 text-sm">
            {STEPS[mode].map((s, i) => (
              <li key={s} className={`flex items-center gap-2 transition ${i <= step ? "text-fg" : "text-muted/50"}`}>
                {i < step ? <Icon.check className="size-4 text-emerald-500" />
                  : i === step ? <span className="size-4 grid place-items-center"><span className="size-2 animate-ping rounded-full bg-accent-2" /></span>
                  : <span className="size-4 grid place-items-center"><span className="size-1.5 rounded-full bg-current" /></span>}
                {s}
              </li>
            ))}
            <li className="mt-1 text-xs text-muted">Usually takes 30–90 seconds.</li>
          </ol>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}
      </Card>

      {data && <Results polish={data.polish} repoName={data.repo?.fullName} />}

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
        Built with Next.js & Claude · Your code is read via the public GitHub API and never stored.
      </footer>
    </main>
  );
}
