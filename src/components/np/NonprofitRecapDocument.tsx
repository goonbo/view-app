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
import {
  AIApprovalBar,
  type AIApprovalState,
} from "@/components/shared/AIApprovalBar";
import { useClaudeStatus } from "@/lib/claude-status-context";
import { Button } from "@/components/ui/button";

export type NonprofitRecapInitial = {
  id: string;
  period: string;
  nonprofitName: string;
  approverName: string;
  approverRole: string;
  /** When undefined, the page will stream a fresh recap. */
  saved?: {
    status: "awaiting_approval" | "approved";
    opening_para: string;
    partner_contributions: {
      partner_workspace_id: string;
      partner_name: string;
      paragraph: string;
      named_volunteers: string[];
    }[];
    what_worked: string;
    what_drifted: string;
    ask_for_next_quarter: string;
    approved_at: string | null;
  };
};

type Stage = { label: string; status: "running" | "done" };

type StructuredTail = {
  partner_contributions: {
    partner_workspace_id: string;
    partner_name: string;
    paragraph: string;
    named_volunteers: string[];
  }[];
  what_worked: string;
  what_drifted: string;
  ask_for_next_quarter: string;
};

/**
 * Nonprofit-side Blueprint recap document. Streams the narrative as a
 * single prose body (opening + what-worked + what-drifted + ask are all
 * woven through the streamed text), then surfaces the partner
 * contributions block once the structured tail arrives.
 */
export function NonprofitRecapDocument(props: NonprofitRecapInitial) {
  const router = useRouter();
  const { beginAction, endAction } = useClaudeStatus();

  const [stages, setStages] = React.useState<Stage[]>([]);
  const [narrative, setNarrative] = React.useState<string>(
    props.saved?.opening_para ?? "",
  );
  // Streaming defaults true when we don't have a saved version — the
  // effect below opens an EventSource. Initializing here (rather than
  // setting state synchronously inside the effect) keeps the React
  // Compiler hooks lint rule happy.
  const [streaming, setStreaming] = React.useState(!props.saved);
  const [structured, setStructured] = React.useState<StructuredTail | null>(
    props.saved
      ? {
          partner_contributions: props.saved.partner_contributions,
          what_worked: props.saved.what_worked,
          what_drifted: props.saved.what_drifted,
          ask_for_next_quarter: props.saved.ask_for_next_quarter,
        }
      : null,
  );
  const [persistStatus, setPersistStatus] = React.useState<
    "idle" | "saving" | "saved" | "failed"
  >("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [approval, setApproval] = React.useState<AIApprovalState>(() => {
    const saved = props.saved;
    if (saved?.status === "approved") {
      return {
        kind: "approved",
        by: props.approverName,
        at: relTime(saved.approved_at),
        wasEdited: false,
      };
    }
    return {
      kind: "pending",
      draftedAt: "moments ago",
      model: "claude-sonnet-4-6",
    };
  });

  const persistDocument = React.useCallback(
    async (text: string, s: StructuredTail | null) => {
      if (!s) return;
      setPersistStatus("saving");
      try {
        const res = await fetch(`/api/np/recaps/${props.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opening_para: text,
            partner_contributions: s.partner_contributions,
            what_worked: s.what_worked,
            what_drifted: s.what_drifted,
            ask_for_next_quarter: s.ask_for_next_quarter,
          }),
        });
        if (!res.ok) throw new Error(`save ${res.status}`);
        setPersistStatus("saved");
      } catch {
        setPersistStatus("failed");
      }
    },
    [props.id],
  );

  React.useEffect(() => {
    if (props.saved) return;
    const startedAt = Date.now();
    beginAction("writing your quarterly recap");

    const es = new EventSource(`/api/np/recaps/${props.id}/stream`);
    let collected = "";
    let collectedStructured: StructuredTail | null = null;
    let cancelled = false;

    const addStage = (s: Stage) => {
      setStages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.label === s.label) {
          return [...prev.slice(0, -1), s];
        }
        return [...prev, s];
      });
    };

    es.addEventListener("stage", (e) => {
      addStage(JSON.parse((e as MessageEvent).data) as Stage);
    });
    es.addEventListener("ai-token", (e) => {
      const { delta } = JSON.parse((e as MessageEvent).data) as {
        delta: string;
      };
      collected += delta;
      setNarrative(collected);
    });
    es.addEventListener("structured-result", (e) => {
      const payload = JSON.parse(
        (e as MessageEvent).data,
      ) as StructuredTail;
      collectedStructured = payload;
      setStructured(payload);
    });
    es.addEventListener("complete", () => {
      if (cancelled) return;
      es.close();
      endAction();
      setStreaming(false);
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
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

  async function handleApprove() {
    const res = await fetch(`/api/np/recaps/${props.id}/approve`, {
      method: "POST",
    });
    if (!res.ok) return;
    setApproval({
      kind: "approved",
      by: props.approverName,
      at: "just now",
      wasEdited: false,
    });
    router.refresh();
  }

  const partners = structured?.partner_contributions ?? [];

  return (
    <BlueprintDocument>
      <BlueprintHero
        eyebrow={
          <>
            QUARTERLY IMPACT RECAP ·{" "}
            <span className="font-mono">{props.period}</span>
          </>
        }
        title={`A note from ${props.nonprofitName}.`}
        subtitle={`Prepared for donors and the board — ${props.period} in gratitude.`}
        meta={`Drafted by Claude Sonnet 4.6${
          persistStatus === "saved" ? " · saved" : ""
        }`}
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
              <span
                className={
                  s.status === "done" ? "text-success" : "text-accent-cyan"
                }
              >
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
        <NarrativeBody text={narrative} streaming={streaming} />
      </BlueprintSection>

      {partners.length > 0 && (
        <BlueprintSection eyebrow="PARTNER CONTRIBUTIONS">
          <div className="space-y-6">
            {partners.map((p) => (
              <article key={p.partner_workspace_id}>
                <h3 className="font-serif text-[24px] leading-tight text-ink">
                  {p.partner_name}
                </h3>
                <p className="mt-2 text-[15px] leading-[1.65] text-ink">
                  {p.paragraph}
                </p>
                {p.named_volunteers.length > 0 && (
                  <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                    Named: {p.named_volunteers.join(" · ")}
                  </p>
                )}
              </article>
            ))}
          </div>
        </BlueprintSection>
      )}

      {(structured || props.saved) && (
        <div className="mt-12 space-y-4">
          <AIApprovalBar
            state={approval}
            onApprove={handleApprove}
            onReject={() => {}}
          />
          {approval.kind === "approved" && (
            <div className="flex items-center justify-end">
              <Button asChild>
                <Link href={`/np/recap/${props.id}/artifacts`}>
                  Generate marketing artifacts
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          )}
          <p className="text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Approver: {props.approverName} · {props.approverRole}
          </p>
        </div>
      )}
    </BlueprintDocument>
  );
}

function NarrativeBody({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  const blocks = parseBlocks(text);
  return (
    <div className="mt-4 space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "h2")
          return (
            <h3
              key={i}
              className="mt-6 font-serif text-[24px] leading-tight text-ink"
            >
              {b.text}
            </h3>
          );
        if (b.type === "ul")
          return (
            <ul
              key={i}
              className="list-disc space-y-1 pl-5 text-[15px] leading-[1.65] text-ink"
            >
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

/**
 * Markdown-lite parser. Detects:
 *  - lines like "What worked." / "What drifted." / "The ask…" as h2
 *  - bullet lines starting with "- " or "* "
 *  - blank-line-separated paragraphs
 */
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
  // Treat short single-line paragraphs ending in "." (followed by a blank
  // line, then more text) as soft section dividers.
  const SECTION_LABELS = new Set([
    "what worked.",
    "what drifted.",
    "the ask for next quarter.",
  ]);
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
    if (SECTION_LABELS.has(trimmed.toLowerCase())) {
      flushParagraph();
      flushBullets();
      out.push({ type: "h2", text: trimmed });
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
