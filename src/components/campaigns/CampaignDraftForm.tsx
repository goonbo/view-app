"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Calendar, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { AIApprovalBar, type AIApprovalState } from "@/components/shared/AIApprovalBar";
import { useClaudeStatus } from "@/lib/claude-status-context";
import type { CampaignDraft } from "@/lib/llm/campaign-draft";

type Props = {
  defaultStart: string;
  defaultEnd: string;
};

export function CampaignDraftForm({ defaultStart, defaultEnd }: Props) {
  const router = useRouter();
  const { beginAction, endAction } = useClaudeStatus();

  const [oneLiner, setOneLiner] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [draft, setDraft] = React.useState<CampaignDraft | null>(null);
  const [draftOriginal, setDraftOriginal] = React.useState<CampaignDraft | null>(null);
  const [start, setStart] = React.useState(defaultStart);
  const [end, setEnd] = React.useState(defaultEnd);
  const [error, setError] = React.useState<string | null>(null);
  const [approval, setApproval] = React.useState<AIApprovalState | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [persisting, setPersisting] = React.useState(false);

  async function generate() {
    if (oneLiner.trim().length < 12) {
      setError("Add a bit more detail.");
      return;
    }
    setError(null);
    setGenerating(true);
    beginAction("drafting your campaign");
    try {
      const res = await fetch("/api/campaigns/draft-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: oneLiner }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Draft failed (${res.status})`);
      }
      const data = (await res.json()) as { draft: CampaignDraft };
      setDraft(data.draft);
      setDraftOriginal(data.draft);
      setApproval({ kind: "pending", draftedAt: "just now", model: "claude-sonnet-4-6" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
      endAction();
    }
  }

  function update<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  }

  async function approve() {
    if (!draft) return;
    setPersisting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          story: draft.story,
          goal_amount: draft.suggested_goal,
          starts_at: new Date(`${start}T00:00:00`).toISOString(),
          ends_at: new Date(`${end}T23:59:59`).toISOString(),
          giving_ladder: draft.giving_ladder,
          ai_brief: draft.story,
          ai_brief_original: draftOriginal?.story,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      const data = (await res.json()) as { campaign: { id: string } };
      router.push(`/campaigns/${data.campaign.id}`);
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

  if (!draft && !generating) {
    return (
      <div className="space-y-3">
        <Textarea
          rows={5}
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          placeholder="Spring backpack drive, $18K to assemble 1,200 school supply kits for returning students."
          className="text-[15px] leading-[1.5]"
        />
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] leading-[1.4] text-ink-faint">
            Claude reads your one-liner and produces a publishable campaign brief.
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
      <article className="rounded-md border border-hairline bg-paper p-6">
        <EyebrowLabel className="mb-2">CAMPAIGN BRIEF · CLAUDE DRAFTED</EyebrowLabel>
        {editing ? (
          <Input
            value={draft.title}
            onChange={(e) => update("title", e.target.value)}
            className="mb-3 text-[20px] font-medium text-ink"
          />
        ) : (
          <h2 className="mb-3 text-[20px] font-medium leading-tight text-ink">
            {draft.title}
          </h2>
        )}

        {editing ? (
          <Textarea
            rows={6}
            value={draft.story}
            onChange={(e) => update("story", e.target.value)}
            className="mb-5 text-[14px] leading-[1.6]"
          />
        ) : (
          <p className="mb-5 whitespace-pre-line text-[14px] leading-[1.6] text-ink-subtle">
            {draft.story}
          </p>
        )}

        <Section eyebrow="WHEN">
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="h-8 w-40"
            />
            <span className="font-mono text-[11px] text-ink-faint">through</span>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-8 w-40"
            />
          </div>
        </Section>

        <Section eyebrow="SUGGESTED GOAL">
          <div className="flex items-baseline gap-2">
            <Heart className="h-3.5 w-3.5 text-accent" aria-hidden />
            {editing ? (
              <Input
                type="number"
                value={draft.suggested_goal}
                onChange={(e) => update("suggested_goal", Number(e.target.value))}
                className="h-8 w-32 font-mono"
              />
            ) : (
              <span className="font-mono text-[20px] font-medium text-ink">
                ${draft.suggested_goal.toLocaleString()}
              </span>
            )}
            <span className="text-[14px] text-ink-subtle">{draft.goal_reasoning}</span>
          </div>
        </Section>

        <Section eyebrow="GIVING LADDER">
          <ul className="space-y-2">
            {draft.giving_ladder.map((tier, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-mist px-3 py-2"
              >
                <span className="font-mono text-[14px] font-medium text-ink">
                  ${tier.amount.toLocaleString()}
                </span>
                <span className="flex-1 text-[13px] text-ink-subtle">{tier.description}</span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] leading-[1.4] text-ink-faint">
          <Sparkles className="h-3 w-3 text-accent-cyan" aria-hidden />
          Drafted by Claude · claude-sonnet-4-6
        </div>
      </article>

      {error && <p className="text-[12px] text-danger">{error}</p>}

      {approval && (
        <AIApprovalBar
          state={
            editing
              ? { kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" }
              : approval
          }
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

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-hairline pt-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {eyebrow}
      </div>
      {children}
    </section>
  );
}
