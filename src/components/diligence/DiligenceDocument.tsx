"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BlueprintDocument,
  BlueprintHero,
  BlueprintSection,
} from "@/components/shared/BlueprintDocument";
import { AIApprovalBar, type AIApprovalState } from "@/components/shared/AIApprovalBar";
import {
  DiligenceVerifiedBlock,
  FilingSummaryBlock,
  type FilingSummary,
  type VerifiedFacts,
} from "./DiligenceVerifiedBlock";
import { DiligenceNarrativeStream } from "./DiligenceNarrativeStream";
import { ThingsToVerifyList } from "./ThingsToVerifyList";
import { ConcernFlag, type ConcernLevel } from "./ConcernFlag";
import { useClaudeStatus } from "@/lib/claude-status-context";
import { Loader2, Check, Minus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Stage = {
  section: number;
  label: string;
  status: "running" | "done" | "skipped";
};

export type DiligenceInitial = {
  diligenceId: string;
  partnerId: string;
  ein: string;
  corporateWorkspaceName: string;
  primaryCauseArea: string;
  /** When true, the page hydrates from saved DB data and skips the stream. */
  savedSnapshot?: {
    status: "ready_for_review" | "approved" | "rejected";
    narrative: string;
    narrativeOriginal?: string | null;
    things_to_verify: string[];
    concern_level: ConcernLevel;
    signals: {
      verified_facts: VerifiedFacts;
      filing_summary: FilingSummary | null;
    };
    approvedBy?: string | null;
    approvedAt?: string | null;
    editedAt?: string | null;
    rejectionReason?: string | null;
  };
  approverName: string;
};

const SECTION_LABELS: Record<number, string> = {
  1: "IRS verification",
  2: "Form 990 financial summary",
  3: "Charity Navigator cross-check",
  4: "Synthesis",
  5: "Things to verify",
};

export function DiligenceDocument(props: DiligenceInitial) {
  const router = useRouter();
  const { beginAction, endAction } = useClaudeStatus();

  const [stages, setStages] = React.useState<Stage[]>([]);
  const [verifiedFacts, setVerifiedFacts] = React.useState<VerifiedFacts | null>(
    props.savedSnapshot?.signals.verified_facts ?? null,
  );
  const [filingSummary, setFilingSummary] = React.useState<FilingSummary | null>(
    props.savedSnapshot?.signals.filing_summary ?? null,
  );
  const [narrative, setNarrative] = React.useState<string>(
    props.savedSnapshot?.narrative ?? "",
  );
  const [narrativeStreaming, setNarrativeStreaming] = React.useState(false);
  const [concernLevel, setConcernLevel] = React.useState<ConcernLevel | null>(
    props.savedSnapshot?.concern_level ?? null,
  );
  const [thingsToVerify, setThingsToVerify] = React.useState<string[]>(
    props.savedSnapshot?.things_to_verify ?? [],
  );
  const [streamError, setStreamError] = React.useState<string | null>(null);
  const [persistStatus, setPersistStatus] = React.useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );

  const [approvalState, setApprovalState] = React.useState<AIApprovalState>(() => {
    const snap = props.savedSnapshot;
    if (!snap) return { kind: "pending", draftedAt: "just now", model: "claude-sonnet-4-6" };
    if (snap.status === "approved") {
      return {
        kind: "approved",
        by: props.approverName,
        at: relTime(snap.approvedAt),
        wasEdited: Boolean(snap.editedAt && snap.narrativeOriginal),
      };
    }
    if (snap.status === "rejected") {
      return {
        kind: "rejected",
        by: props.approverName,
        at: relTime(snap.editedAt),
        reason: snap.rejectionReason ?? undefined,
      };
    }
    return {
      kind: "pending",
      draftedAt: relTime(null) ?? "moments ago",
      model: "claude-sonnet-4-6",
    };
  });

  const [editing, setEditing] = React.useState(false);
  const [editDraft, setEditDraft] = React.useState(narrative);

  React.useEffect(() => {
    if (props.savedSnapshot) return;
    const elapsed = Date.now();
    beginAction("generating diligence");

    const es = new EventSource(`/api/diligence/${props.diligenceId}/stream`);
    let collectedNarrative = "";
    let collectedFacts: VerifiedFacts | null = null;
    let collectedFiling: FilingSummary | null = null;
    let collectedConcern: ConcernLevel | null = null;
    let collectedThings: string[] = [];

    const upsertStage = (s: Stage) => {
      setStages((prev) => {
        const idx = prev.findIndex((p) => p.section === s.section);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = s;
          return next;
        }
        return [...prev, s];
      });
    };

    es.addEventListener("stage", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as Stage;
      upsertStage(payload);
      if (payload.section === 4 && payload.status === "running") {
        setNarrativeStreaming(true);
      }
      if (payload.section === 4 && payload.status === "done") {
        setNarrativeStreaming(false);
      }
    });
    es.addEventListener("verified-facts", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as VerifiedFacts & { section: number };
      const { ...facts } = payload;
      collectedFacts = facts;
      setVerifiedFacts(facts);
    });
    es.addEventListener("filing-summary", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as FilingSummary & { section: number };
      collectedFiling = payload;
      setFilingSummary(payload);
    });
    es.addEventListener("ai-token", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as { delta: string };
      collectedNarrative += payload.delta;
      setNarrative(collectedNarrative);
    });
    es.addEventListener("structured-result", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as {
        concern_level: ConcernLevel;
        things_to_verify: string[];
      };
      collectedConcern = payload.concern_level;
      collectedThings = payload.things_to_verify;
      setConcernLevel(payload.concern_level);
      setThingsToVerify(payload.things_to_verify);
    });
    es.addEventListener("complete", () => {
      es.close();
      endAction();
      setEditDraft(collectedNarrative);
      const elapsedSec = Math.round((Date.now() - elapsed) / 1000);
      setApprovalState({
        kind: "pending",
        draftedAt: `${elapsedSec}s ago`,
        model: "claude-sonnet-4-6",
      });
      void persistDocument({
        narrative: collectedNarrative,
        verifiedFacts: collectedFacts,
        filingSummary: collectedFiling,
        concernLevel: collectedConcern,
        thingsToVerify: collectedThings,
      });
    });
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      try {
        const parsed = data ? JSON.parse(data) : null;
        if (parsed?.message) setStreamError(parsed.message);
      } catch {
        setStreamError("Stream error — see server logs.");
      }
      es.close();
      endAction();
    });

    return () => {
      es.close();
      endAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistDocument(payload: {
    narrative: string;
    verifiedFacts: VerifiedFacts | null;
    filingSummary: FilingSummary | null;
    concernLevel: ConcernLevel | null;
    thingsToVerify: string[];
  }) {
    setPersistStatus("saving");
    try {
      const res = await fetch(`/api/diligence/${props.diligenceId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrative: payload.narrative,
          things_to_verify: payload.thingsToVerify,
          concern_level: payload.concernLevel,
          signals: {
            verified_facts: payload.verifiedFacts,
            filing_summary: payload.filingSummary,
          },
        }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      setPersistStatus("saved");
    } catch (err) {
      console.error(err);
      setPersistStatus("failed");
    }
  }

  async function handleApprove() {
    const res = await fetch(`/api/diligence/${props.diligenceId}/approve`, {
      method: "POST",
    });
    if (!res.ok) {
      console.error("approve failed", res.status);
      return;
    }
    setApprovalState({
      kind: "approved",
      by: props.approverName,
      at: "just now",
      wasEdited: editing || approvalState.kind === "edited",
    });
    router.refresh();
  }

  async function handleEditSave() {
    const res = await fetch(`/api/diligence/${props.diligenceId}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narrative: editDraft }),
    });
    if (!res.ok) {
      console.error("edit save failed", res.status);
      return;
    }
    setNarrative(editDraft);
    setEditing(false);
    setApprovalState({ kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" });
  }

  async function handleReject(reason: string) {
    const res = await fetch(`/api/diligence/${props.diligenceId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      console.error("reject failed", res.status);
      return;
    }
    setApprovalState({
      kind: "rejected",
      by: props.approverName,
      at: "just now",
      reason: reason || undefined,
    });
    router.refresh();
  }

  const orgDisplayName =
    verifiedFacts?.common_name || verifiedFacts?.legal_name || "(loading…)";

  return (
    <BlueprintDocument>
      <BlueprintHero
        eyebrow={
          <>
            DILIGENCE REPORT ·{" "}
            <span className="font-mono">{formatEin(props.ein)}</span>
          </>
        }
        title={orgDisplayName}
        subtitle={
          <>
            Read for {props.corporateWorkspaceName}&apos;s {props.primaryCauseArea} focus
          </>
        }
        meta={`Generated by Claude Sonnet 4.6${persistStatus === "saved" ? " · saved" : ""}`}
      />

      {streamError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-danger">
          {streamError}
        </div>
      )}

      <StagesPanel stages={stages} active={!props.savedSnapshot} />

      {verifiedFacts && (
        <BlueprintSection eyebrow="§ 01 IRS VERIFICATION">
          <DiligenceVerifiedBlock facts={verifiedFacts} />
        </BlueprintSection>
      )}

      {filingSummary && (
        <BlueprintSection eyebrow={`§ 02 FORM 990 · FY${filingSummary.tax_period}`}>
          <FilingSummaryBlock summary={filingSummary} />
        </BlueprintSection>
      )}

      <CharityNavSection stages={stages} />

      {(narrative || narrativeStreaming) && (
        <BlueprintSection eyebrow="§ 04 SYNTHESIS">
          {editing ? (
            <Textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={6}
              className="text-[16px] leading-[1.6]"
            />
          ) : (
            <DiligenceNarrativeStream text={narrative} streaming={narrativeStreaming} />
          )}
        </BlueprintSection>
      )}

      {concernLevel && thingsToVerify.length > 0 && (
        <BlueprintSection eyebrow="§ 05 THINGS TO VERIFY">
          <div className="mb-4">
            <ConcernFlag level={concernLevel} />
          </div>
          <ThingsToVerifyList items={thingsToVerify} />
        </BlueprintSection>
      )}

      {concernLevel && thingsToVerify.length > 0 && (
        <div className="mt-10">
          <AIApprovalBar
            state={editing ? { kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" } : approvalState}
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
            onReject={handleReject}
          />
        </div>
      )}
    </BlueprintDocument>
  );
}

function StagesPanel({ stages, active }: { stages: Stage[]; active: boolean }) {
  if (!active && stages.length === 0) return null;
  if (stages.length === 0) {
    return (
      <div className="mt-10 rounded-md border border-hairline bg-paper px-5 py-4 font-mono text-[11px] text-ink-subtle">
        Initializing…
      </div>
    );
  }
  return (
    <div className="mt-10 rounded-md border border-hairline bg-paper px-5 py-4">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
        Process
      </div>
      <ol className="space-y-2">
        {stages.map((s) => (
          <li
            key={s.section}
            className={cn(
              "flex items-start gap-2 font-mono text-[12px] leading-[1.5]",
              s.status === "running" ? "text-ink" : "text-ink-subtle",
            )}
          >
            <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center">
              {s.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin text-accent-cyan" />
              ) : s.status === "skipped" ? (
                <Minus className="h-3 w-3 text-ink-faint" />
              ) : (
                <Check className="h-3 w-3 text-success" />
              )}
            </span>
            <span className="flex-1">
              <span className="text-ink-faint">{SECTION_LABELS[s.section]}</span>{" "}
              <span>· {s.label}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CharityNavSection({ stages }: { stages: Stage[] }) {
  const s = stages.find((x) => x.section === 3);
  if (!s) return null;
  if (s.status !== "skipped") return null;
  return (
    <BlueprintSection eyebrow="§ 03 CHARITY NAVIGATOR">
      <div className="rounded-md border border-hairline bg-mist px-4 py-3 text-[13px] leading-[1.5] text-ink-subtle">
        Charity Navigator not configured for this run. To enrich diligence
        with their rating, add <code className="font-mono text-[12px]">CHARITY_NAVIGATOR_API_KEY</code> to
        <code className="font-mono text-[12px]"> .env.local</code>.
      </div>
    </BlueprintSection>
  );
}

function formatEin(raw: string): string {
  const c = raw.replace(/-/g, "");
  if (c.length !== 9) return c;
  return `${c.slice(0, 2)}-${c.slice(2)}`;
}

function relTime(at: string | null | undefined): string {
  if (!at) return "just now";
  const ms = Date.now() - new Date(at).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
