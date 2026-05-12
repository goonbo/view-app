"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  BlueprintDocument,
  BlueprintHero,
  BlueprintSection,
} from "@/components/shared/BlueprintDocument";
import { AIApprovalBar, type AIApprovalState } from "@/components/shared/AIApprovalBar";
import { useClaudeStatus } from "@/lib/claude-status-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type RecapInitial = {
  id: string;
  title: string;
  scope: string;
  periodStart: string;
  periodEnd: string;
  approverName: string;
  partnerLine: string;
  /** When undefined, the page will stream a fresh recap. */
  saved?: {
    status: "draft" | "approved";
    lede: string | null;
    narrative_md: string;
    narrative_md_original: string | null;
    by_the_numbers: Record<string, string | number>;
    outcomes: { headline: string; body: string }[];
    recommendations: { headline: string; body: string }[];
    approved_at: string | null;
  };
};

type Stage = { label: string; status: "running" | "done" };

export function RecapDocument(props: RecapInitial) {
  const router = useRouter();
  const { beginAction, endAction } = useClaudeStatus();

  const [stages, setStages] = React.useState<Stage[]>([]);
  const [narrative, setNarrative] = React.useState<string>(props.saved?.narrative_md ?? "");
  const [streaming, setStreaming] = React.useState(false);
  const [structured, setStructured] = React.useState<{
    by_the_numbers: Record<string, string | number>;
    outcomes: { headline: string; body: string }[];
    recommendations: { headline: string; body: string }[];
  } | null>(
    props.saved
      ? {
          by_the_numbers: props.saved.by_the_numbers,
          outcomes: props.saved.outcomes,
          recommendations: props.saved.recommendations,
        }
      : null,
  );
  const [persistStatus, setPersistStatus] = React.useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState(narrative);
  const [approval, setApproval] = React.useState<AIApprovalState>(() => {
    const saved = props.saved;
    if (saved?.status === "approved") {
      return {
        kind: "approved",
        by: props.approverName,
        at: relTime(saved.approved_at),
        wasEdited: Boolean(saved.narrative_md_original),
      };
    }
    return { kind: "pending", draftedAt: "moments ago", model: "claude-sonnet-4-6" };
  });

  React.useEffect(() => {
    if (props.saved) return;
    const elapsed = Date.now();
    beginAction("writing your recap");
    setStreaming(true);

    const es = new EventSource(`/api/recaps/${props.id}/generate`);
    let collected = "";
    let collectedStructured: typeof structured = null;
    let cancelled = false;

    const addStage = (s: Stage) => {
      setStages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.label === s.label) {
          const next = prev.slice(0, -1);
          return [...next, s];
        }
        return [...prev, s];
      });
    };

    es.addEventListener("stage", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as Stage;
      addStage(payload);
    });
    es.addEventListener("ai-token", (e) => {
      const { delta } = JSON.parse((e as MessageEvent).data) as { delta: string };
      collected += delta;
      setNarrative(collected);
    });
    es.addEventListener("structured-result", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as {
        by_the_numbers: Record<string, string | number>;
        outcomes: { headline: string; body: string }[];
        recommendations: { headline: string; body: string }[];
      };
      collectedStructured = payload;
      setStructured(payload);
    });
    es.addEventListener("complete", () => {
      if (cancelled) return;
      es.close();
      endAction();
      setStreaming(false);
      setEditDraft(collected);
      const elapsedSec = Math.round((Date.now() - elapsed) / 1000);
      setApproval({
        kind: "pending",
        draftedAt: `${elapsedSec}s ago`,
        model: "claude-sonnet-4-6",
      });
      void persistDocument(collected, collectedStructured);
    });
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      try {
        const parsed = data ? JSON.parse(data) : null;
        if (parsed?.message) setError(parsed.message);
      } catch {
        setError("Stream error — see server logs.");
      }
      es.close();
      endAction();
      setStreaming(false);
    });

    return () => {
      cancelled = true;
      es.close();
      endAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistDocument(
    text: string,
    s: {
      by_the_numbers: Record<string, string | number>;
      outcomes: { headline: string; body: string }[];
      recommendations: { headline: string; body: string }[];
    } | null,
  ) {
    if (!s) return;
    setPersistStatus("saving");
    try {
      const res = await fetch(`/api/recaps/${props.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrative_md: text,
          by_the_numbers: s.by_the_numbers,
          outcomes: s.outcomes,
          recommendations: s.recommendations,
        }),
      });
      if (!res.ok) throw new Error(`save ${res.status}`);
      setPersistStatus("saved");
    } catch {
      setPersistStatus("failed");
    }
  }

  async function handleApprove() {
    const res = await fetch(`/api/recaps/${props.id}/approve`, { method: "POST" });
    if (!res.ok) return;
    setApproval({
      kind: "approved",
      by: props.approverName,
      at: "just now",
      wasEdited: editing,
    });
    router.refresh();
  }

  async function handleEditSave() {
    const res = await fetch(`/api/recaps/${props.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narrative_md: editDraft }),
    });
    if (!res.ok) return;
    setNarrative(editDraft);
    setEditing(false);
    setApproval({ kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" });
  }

  const numbers = structured?.by_the_numbers ?? {};
  const numberEntries = Object.entries(numbers);
  const outcomes = structured?.outcomes ?? [];
  const recommendations = structured?.recommendations ?? [];

  return (
    <BlueprintDocument>
      <BlueprintHero
        eyebrow={
          <>
            {props.scope === "event" ? "EVENT RECAP" : "QUARTERLY RECAP"} ·{" "}
            <span className="font-mono">{formatDate(props.periodStart)}</span>
            {" – "}
            <span className="font-mono">{formatDate(props.periodEnd)}</span>
          </>
        }
        title={props.title}
        subtitle={props.partnerLine}
        meta={`Prepared by Claude Sonnet 4.6${persistStatus === "saved" ? " · saved" : ""}`}
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-danger">
          {error}
        </div>
      )}

      {stages.length > 0 && approval.kind === "pending" && !props.saved && (
        <div className="mt-10 rounded-md border border-hairline bg-paper px-5 py-4 font-mono text-[11px] text-ink-subtle">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={s.status === "done" ? "text-success" : "text-accent-cyan"}>
                {s.status === "done" ? "✓" : "•"}
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <BlueprintSection>
        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent-cyan">
          <Sparkles className="h-3 w-3" aria-hidden />
          Claude drafted
        </div>
        {editing ? (
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={12}
            className="mt-3 text-[15px] leading-[1.65]"
          />
        ) : (
          <NarrativeBody text={narrative} streaming={streaming} />
        )}
      </BlueprintSection>

      {numberEntries.length > 0 && (
        <BlueprintSection eyebrow="BY THE NUMBERS">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
            {numberEntries.map(([key, value]) => (
              <div key={key}>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd className="font-mono text-[20px] font-medium text-ink">
                  {typeof value === "number" ? value.toLocaleString() : value}
                </dd>
              </div>
            ))}
          </dl>
        </BlueprintSection>
      )}

      {outcomes.length > 0 && (
        <BlueprintSection eyebrow="THREE OUTCOMES">
          <div className="space-y-4">
            {outcomes.map((o, i) => (
              <article
                key={i}
                className="rounded-md border border-hairline bg-paper px-5 py-4"
              >
                <h3 className="text-[16px] font-medium leading-tight text-ink">
                  {o.headline}
                </h3>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-subtle">{o.body}</p>
              </article>
            ))}
          </div>
        </BlueprintSection>
      )}

      {recommendations.length > 0 && (
        <BlueprintSection eyebrow="THREE RECOMMENDATIONS FOR NEXT QUARTER">
          <ol className="space-y-4">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-4">
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper font-mono text-[11px] text-ink-subtle"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[16px] font-medium leading-tight text-ink">
                    {r.headline}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-[1.55] text-ink-subtle">{r.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </BlueprintSection>
      )}

      {(structured || props.saved) && (
        <div className="mt-12 space-y-4">
          <AIApprovalBar
            state={editing ? { kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" } : approval}
            onApprove={handleApprove}
            onEditStart={() => {
              setEditing(true);
              setEditDraft(narrative);
            }}
            onEditCancel={() => {
              setEditing(false);
              setEditDraft(narrative);
            }}
            onEditSave={handleEditSave}
            onReject={() => {}}
          />
          {approval.kind === "approved" && (
            <div className="flex items-center justify-end">
              <Button asChild>
                <Link href={`/recaps/${props.id}/marketing`}>
                  Generate marketing artifacts
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </BlueprintDocument>
  );
}

function NarrativeBody({ text, streaming }: { text: string; streaming: boolean }) {
  // Render markdown-lite: split paragraphs by blank lines, render ## as
  // subsection headings, * bullets as list items, otherwise paragraphs.
  const blocks = parseBlocks(text);
  return (
    <div className="mt-4 space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "h2")
          return (
            <h3 key={i} className="mt-6 font-serif text-[24px] leading-tight text-ink">
              {b.text}
            </h3>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-[15px] leading-[1.65] text-ink">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="text-[15px] leading-[1.65] text-ink">
            {b.text}
            {i === blocks.length - 1 && streaming && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-ink-faint motion-safe:animate-pulse"
              />
            )}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const out: Block[] = [];
  let buffer: string[] = [];
  let bullets: string[] = [];
  const flushParagraph = () => {
    if (buffer.length) {
      out.push({ type: "p", text: buffer.join(" ").trim() });
      buffer = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push({ type: "ul", items: bullets });
      bullets = [];
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushBullets();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushBullets();
      out.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushBullets();
      out.push({ type: "h2", text: trimmed.replace(/^###\s+/, "") });
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      bullets.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushBullets();
    buffer.push(trimmed);
  }
  flushParagraph();
  flushBullets();
  return out;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relTime(iso: string | null): string {
  if (!iso) return "just now";
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  return `${mo} mo ago`;
}
