"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { AIApprovalBar, type AIApprovalState } from "@/components/shared/AIApprovalBar";
import { useClaudeStatus } from "@/lib/claude-status-context";
import type { EventDraft } from "@/lib/llm/event-draft";
import { cn } from "@/lib/utils";

type Props = {
  defaultDate: string;
};

export function EventDraftForm({ defaultDate }: Props) {
  const router = useRouter();
  const { beginAction, endAction } = useClaudeStatus();

  const [oneLiner, setOneLiner] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [generatedAt, setGeneratedAt] = React.useState<Date | null>(null);
  const [draft, setDraft] = React.useState<EventDraft | null>(null);
  const [draftOriginal, setDraftOriginal] = React.useState<EventDraft | null>(null);
  const [date, setDate] = React.useState(defaultDate);
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("12:00");
  const [error, setError] = React.useState<string | null>(null);
  const [approval, setApproval] = React.useState<AIApprovalState | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [persisting, setPersisting] = React.useState(false);

  async function generate() {
    if (oneLiner.trim().length < 12) {
      setError("Add a bit more detail — at least a dozen words.");
      return;
    }
    setError(null);
    setGenerating(true);
    beginAction("drafting your event");
    try {
      const res = await fetch("/api/events/draft-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: oneLiner }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Draft failed (${res.status})`);
      }
      const data = (await res.json()) as { draft: EventDraft };
      setDraft(data.draft);
      setDraftOriginal(data.draft);
      const now = new Date();
      setGeneratedAt(now);
      setApproval({
        kind: "pending",
        draftedAt: "just now",
        model: "claude-sonnet-4-6",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
      endAction();
    }
  }

  function updateDraft<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  }

  async function approve() {
    if (!draft) return;
    setPersisting(true);
    try {
      const startsAt = new Date(`${date}T${startTime}:00`);
      const endsAt = new Date(`${date}T${endTime}:00`);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          capacity: draft.suggested_capacity,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          supplies: draft.supplies_needed,
          ai_brief: draft.description,
          ai_brief_original: draftOriginal?.description,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      const data = (await res.json()) as { event: { id: string } };
      router.push(`/events/${data.event.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPersisting(false);
    }
  }

  function reject() {
    setDraft(null);
    setDraftOriginal(null);
    setApproval(null);
    setEditing(false);
    setError(null);
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER

  if (!draft && !generating) {
    return (
      <div className="space-y-3">
        <Textarea
          rows={5}
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          placeholder="Quarterly food sort, mid-March, need 30 volunteers, three-hour Saturday morning shift, on-site at our warehouse."
          className="text-[15px] leading-[1.5]"
        />
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] leading-[1.4] text-ink-faint">
            Claude reads your one-liner and produces a publishable brief.
          </p>
          <Button onClick={generate}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Draft with Claude
          </Button>
        </div>
      </div>
    );
  }

  if (generating || !draft) {
    return (
      <div className="space-y-3">
        <Textarea rows={5} value={oneLiner} disabled />
        <div className="rounded-md border border-hairline bg-paper p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-accent-cyan">
            <Loader2 className="h-3 w-3 animate-spin" />
            Claude is drafting…
          </div>
          <Skeleton className="mb-2 h-5 w-3/5" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="mb-2 h-3 w-4/5" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DraftCard
        draft={draft}
        editing={editing}
        date={date}
        startTime={startTime}
        endTime={endTime}
        onChange={updateDraft}
        onDateChange={setDate}
        onStartChange={setStartTime}
        onEndChange={setEndTime}
        generatedAt={generatedAt}
      />
      {error && <p className="text-[12px] text-danger">{error}</p>}
      {approval && (
        <AIApprovalBar
          state={editing ? { kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" } : approval}
          onApprove={persisting ? undefined : approve}
          onEditStart={() => setEditing(true)}
          onEditCancel={() => {
            if (draftOriginal) setDraft(draftOriginal);
            setEditing(false);
          }}
          onEditSave={() => {
            setEditing(false);
            setApproval({ kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" });
          }}
          onReject={reject}
        />
      )}
    </div>
  );
}

function DraftCard({
  draft,
  editing,
  date,
  startTime,
  endTime,
  onChange,
  onDateChange,
  onStartChange,
  onEndChange,
  generatedAt,
}: {
  draft: EventDraft;
  editing: boolean;
  date: string;
  startTime: string;
  endTime: string;
  onChange: <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => void;
  onDateChange: (v: string) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  generatedAt: Date | null;
}) {
  return (
    <article className="rounded-md border border-hairline bg-paper p-6">
      <EyebrowLabel className="mb-2">EVENT BRIEF · CLAUDE DRAFTED</EyebrowLabel>
      {editing ? (
        <Input
          value={draft.title}
          onChange={(e) => onChange("title", e.target.value)}
          className="mb-3 text-[20px] font-medium text-ink"
        />
      ) : (
        <h2 className="mb-3 text-[20px] font-medium leading-tight text-ink">
          {draft.title}
        </h2>
      )}
      {editing ? (
        <Textarea
          rows={4}
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
          className="mb-5 text-[14px] leading-[1.6]"
        />
      ) : (
        <p className="mb-5 whitespace-pre-line text-[14px] leading-[1.6] text-ink-subtle">
          {draft.description}
        </p>
      )}

      <DraftSection eyebrow="WHEN">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
            <Input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="h-8 w-40"
            />
          </div>
          <span className="font-mono text-[11px] text-ink-faint">·</span>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => onStartChange(e.target.value)}
            className="h-8 w-28"
          />
          <span className="font-mono text-[11px] text-ink-faint">to</span>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => onEndChange(e.target.value)}
            className="h-8 w-28"
          />
        </div>
      </DraftSection>

      <DraftSection eyebrow="SUGGESTED CAPACITY">
        <div className="flex items-baseline gap-2">
          {editing ? (
            <Input
              type="number"
              value={draft.suggested_capacity}
              onChange={(e) => onChange("suggested_capacity", Number(e.target.value))}
              className="h-8 w-24 font-mono"
            />
          ) : (
            <span className="font-mono text-[20px] font-medium text-ink">
              {draft.suggested_capacity}
            </span>
          )}
          <span className="text-[14px] text-ink-subtle">{draft.capacity_reasoning}</span>
        </div>
      </DraftSection>

      <DraftSection eyebrow="AGENDA">
        <ul className="space-y-1.5">
          {draft.suggested_agenda.map((item, i) => (
            <li key={i} className="font-mono text-[12px] leading-[1.5] text-ink">
              {item}
            </li>
          ))}
        </ul>
      </DraftSection>

      <DraftSection eyebrow="SUPPLIES NEEDED">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {draft.supplies_needed.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] leading-[1.5] text-ink"
            >
              <span aria-hidden className="mt-1.5 inline-block h-1 w-1 rounded-full bg-ink-faint" />
              {item}
            </li>
          ))}
        </ul>
      </DraftSection>

      <DraftSection eyebrow="CLAUDE WOULD LIKE YOU TO CONFIRM">
        <ul className="space-y-2">
          {draft.followup_questions.map((q, i) => (
            <li
              key={i}
              className="rounded-md border border-dashed border-hairline bg-mist px-3 py-2 text-[13px] leading-[1.5] text-ink-subtle"
            >
              {q}
            </li>
          ))}
        </ul>
      </DraftSection>

      <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] leading-[1.4] text-ink-faint">
        <Sparkles className="h-3 w-3 text-accent-cyan" aria-hidden />
        Drafted by Claude · claude-sonnet-4-6
        {generatedAt && (
          <span>
            {" "}
            · {relTimeShort(generatedAt)}
          </span>
        )}
      </div>
    </article>
  );
}

function DraftSection({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-hairline pt-4">
      <div className={cn("mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint")}>
        {eyebrow}
      </div>
      {children}
    </section>
  );
}

function relTimeShort(at: Date): string {
  const sec = Math.round((Date.now() - at.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return at.toLocaleString();
}
