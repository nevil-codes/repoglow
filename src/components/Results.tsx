"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import type { RepoPolish } from "@/lib/schema";
import { Card, CopyButton, Icon } from "./ui";
import { ShipPanel } from "./ShipPanel";

const TABS = ["README", "Names", "About & Topics", "Packages", "Badges", "Quick wins"] as const;
type Tab = (typeof TABS)[number];

export function Results({ polish, repoName, streaming = false }: { polish: RepoPolish; repoName?: string; streaming?: boolean }) {
  const [tab, setTab] = useState<Tab>("README");
  // User edits to the README (raw view). The parent remounts this component for each new generation.
  const [edited, setEdited] = useState<string | null>(null);
  const readme = edited ?? polish.readme;

  return (
    <section className="mt-10 animate-[fadeUp_.5s_ease-out]">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-widest text-muted">Tagline</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <p className="text-lg font-semibold sm:text-xl">{polish.tagline}</p>
            <CopyButton text={polish.tagline} />
          </div>
          <p className="mt-3 text-sm text-muted">{polish.scorecard.notes}</p>
        </Card>
        <Scorecard current={polish.scorecard.current} potential={polish.scorecard.potential} />
      </div>

      <div className="mt-6 -mx-4 overflow-x-auto px-4">
        <div className="inline-flex gap-1 rounded-xl border border-card-border bg-card p-1 backdrop-blur" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                tab === t ? "btn-glow text-white" : "text-muted hover:text-fg"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {tab === "README" && (
          <ReadmePanel
            markdown={readme}
            repoName={repoName}
            streaming={streaming}
            edited={edited !== null}
            onEdit={setEdited}
            onReset={() => setEdited(null)}
          />
        )}
        {tab === "Names" && <NamesPanel names={polish.names} />}
        {tab === "About & Topics" && <AboutPanel about={polish.aboutDescription} topics={polish.topics} />}
        {tab === "Packages" && <PackagesPanel packages={polish.packages} />}
        {tab === "Badges" && <BadgesPanel badges={polish.badges} />}
        {tab === "Quick wins" && <WinsPanel items={polish.improvements} />}
      </div>

      {repoName && (
        <ShipPanel
          repo={repoName}
          readme={readme}
          aboutDescription={polish.aboutDescription}
          topics={polish.topics}
          disabled={streaming}
        />
      )}
    </section>
  );
}

function Scorecard({ current, potential }: { current: number; potential: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const cur = clamp(current);
  const pot = clamp(potential);
  return (
    <Card className="flex items-center gap-4 p-5">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent-1)" />
            <stop offset="1" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--card-border)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--accent-3)" strokeOpacity=".35" strokeWidth="7"
          strokeDasharray={`${(pot / 100) * c} ${c}`} strokeLinecap="round" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="url(#ring)" strokeWidth="7"
          strokeDasharray={`${(cur / 100) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted">Appeal score</p>
        <p className="text-3xl font-bold tabular-nums">
          {cur}
          <span className="mx-1.5 text-muted">→</span>
          <span className="text-gradient">{pot}</span>
        </p>
        <p className="text-xs text-muted">now → after polish</p>
      </div>
    </Card>
  );
}

function ReadmePanel({
  markdown,
  repoName,
  streaming,
  edited,
  onEdit,
  onReset,
}: {
  markdown: string;
  repoName?: string;
  streaming: boolean;
  edited: boolean;
  onEdit: (md: string) => void;
  onReset: () => void;
}) {
  const [view, setView] = useState<"preview" | "raw">("preview");
  const scrollRef = useRef<HTMLElement>(null);
  // Follow the text while it's being written, unless the user scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!streaming || !el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [markdown, streaming]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "README.md" });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="font-mono">{repoName ? `${repoName}/` : ""}README.md</span>
          {edited && (
            <button onClick={onReset} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 hover:underline dark:text-amber-300" title="Discard your edits">
              edited · reset
            </button>
          )}
          {streaming && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-2/10 px-2 py-0.5 text-xs text-accent-2">
              <span className="size-1.5 animate-pulse rounded-full bg-current" /> writing…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-card-border bg-input p-0.5 text-xs">
            {(["preview", "raw"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 capitalize ${view === v ? "bg-card-border font-semibold text-fg" : "text-muted"}`}>
                {v === "raw" && !streaming ? "edit" : v}
              </button>
            ))}
          </div>
          <CopyButton text={markdown} className={streaming ? "pointer-events-none opacity-50" : ""} />
          <button onClick={download} disabled={streaming}
            className="inline-flex items-center gap-1.5 rounded-lg btn-glow px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
            <Icon.download className="size-3.5" /> Download
          </button>
        </div>
      </div>
      {view === "preview" ? (
        <article ref={scrollRef} className="markdown max-h-[75vh] overflow-auto px-5 py-4 sm:px-8">
          {markdown ? (
            <Markdown>{markdown}</Markdown>
          ) : (
            <ReadmeSkeleton />
          )}
        </article>
      ) : (
        streaming ? (
          <pre ref={scrollRef as React.RefObject<HTMLPreElement>} className="max-h-[75vh] overflow-auto whitespace-pre-wrap p-5 font-mono text-[13px] leading-relaxed">{markdown}</pre>
        ) : (
          <textarea
            value={markdown}
            onChange={(e) => onEdit(e.target.value)}
            spellCheck={false}
            aria-label="Edit README markdown"
            className="block h-[75vh] w-full resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed outline-none"
          />
        )
      )}
    </Card>
  );
}

function ReadmeSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2" aria-label="Writing README">
      <div className="mx-auto h-8 w-1/3 rounded-lg bg-card-border" />
      <div className="mx-auto h-4 w-1/2 rounded bg-card-border" />
      <div className="h-4 w-full rounded bg-card-border" />
      <div className="h-4 w-5/6 rounded bg-card-border" />
      <div className="h-4 w-2/3 rounded bg-card-border" />
    </div>
  );
}

// READMEs lean on raw HTML (centered <div>, <details>, <img>). Render it like GitHub
// does: parse it, then sanitize with GitHub's own allowlist so nothing executes.
function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
      {children}
    </ReactMarkdown>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <Card className="p-8 text-center text-sm text-muted">{children}</Card>;
}

function NamesPanel({ names }: { names: RepoPolish["names"] }) {
  if (!names.length) return <Empty>No name ideas this time — try generating again.</Empty>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {names.map((n, i) => (
        <Card key={n.name} className="group p-5 transition hover:-translate-y-0.5 hover:border-accent-1/40">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-lg font-semibold">
              <span className="mr-2 text-xs text-muted">#{i + 1}</span>
              {n.name}
            </p>
            <CopyButton text={n.name} />
          </div>
          <p className="mt-2 text-sm text-muted">{n.why}</p>
        </Card>
      ))}
    </div>
  );
}

function AboutPanel({ about, topics }: { about: string; topics: string[] }) {
  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted">About description</p>
          <span className={`text-xs tabular-nums ${about.length > 350 ? "text-red-500" : "text-muted"}`}>{about.length}/350</span>
        </div>
        <p className="mt-2 text-base">{about}</p>
        <CopyButton text={about} className="mt-3" />
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted">Topics ({topics.length})</p>
          <CopyButton text={topics.join(", ")} label="Copy all" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.map((t) => (
            <button key={t} onClick={() => navigator.clipboard.writeText(t)} title="Copy"
              className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-600 ring-1 ring-sky-500/20 transition hover:bg-sky-500/20 dark:text-sky-300">
              {t}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          On GitHub: repo page → ⚙️ next to <b>About</b> → paste description & topics.
        </p>
      </Card>
    </div>
  );
}

function PackagesPanel({ packages }: { packages: RepoPolish["packages"] }) {
  if (!packages.length) return <Empty>✅ Your stack already covers the essentials — no new packages to suggest.</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {packages.map((p) => (
        <Card key={p.name} className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono font-semibold">{p.name}</p>
            <span className="rounded-md bg-card-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted">{p.ecosystem}</span>
          </div>
          <p className="mt-2 text-sm text-muted">{p.why}</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-card-border bg-input px-3 py-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{p.installCmd}</code>
            <CopyButton text={p.installCmd} label="" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function BadgesPanel({ badges }: { badges: RepoPolish["badges"] }) {
  const all = badges.map((b) => b.markdown).join(" ");
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted">Badges</p>
        <CopyButton text={all} label="Copy all" />
      </div>
      <div className="markdown mt-4 flex flex-wrap gap-2">
        <Markdown>{all}</Markdown>
      </div>
      <ul className="mt-4 divide-y divide-card-border">
        {badges.map((b) => (
          <li key={b.label} className="flex items-center justify-between gap-3 py-2">
            <span className="text-sm">{b.label}</span>
            <CopyButton text={b.markdown} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

const IMPACT = {
  high: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300",
  medium: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300",
  low: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300",
};

function WinsPanel({ items }: { items: RepoPolish["improvements"] }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  if (!items.length) return <Empty>🎉 No quick wins left — this repo is already in great shape.</Empty>;
  return (
    <Card className="divide-y divide-card-border">
      {items.map((it, i) => (
        <label key={it.title} className="flex cursor-pointer gap-3 p-4 transition hover:bg-card-border/40">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--accent-1)]" checked={done.has(i)}
            onChange={() => setDone((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-medium ${done.has(i) ? "line-through text-muted" : ""}`}>{it.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${IMPACT[it.impact]}`}>{it.impact}</span>
            </div>
            <p className="mt-1 text-sm text-muted">{it.detail}</p>
          </div>
        </label>
      ))}
    </Card>
  );
}
