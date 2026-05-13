"use client";

import * as React from "react";
import {
  Mail,
  FileText,
  Presentation,
  Hash,
  Copy,
  Download,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import {
  AIApprovalBar,
  type AIApprovalState,
} from "@/components/shared/AIApprovalBar";
import { toast } from "sonner";
import { useClaudeStatus } from "@/lib/claude-status-context";
import {
  NONPROFIT_ARTIFACT_LABEL,
  type NonprofitArtifactKind,
} from "@/lib/llm/nonprofit-artifacts";

export type ArtifactRow = {
  id: string;
  recap_id: string;
  kind: NonprofitArtifactKind;
  body: string;
  body_original?: string | null;
  status: "drafting" | "approved" | "rejected";
  approved_at?: string | null;
};

const ICON: Record<NonprofitArtifactKind, typeof Mail> = {
  donor_newsletter: Mail,
  grant_snippet: FileText,
  board_update: Presentation,
  social_thanks: Hash,
};

const HELPER: Record<NonprofitArtifactKind, string> = {
  donor_newsletter: "≈ 150 words · warm, narrative",
  grant_snippet: "≈ 100 words · factual, board-ready",
  board_update: "≈ 120 words · operational + forward-looking",
  social_thanks: "≤ 280 chars · names volunteers",
};

const ORDER: NonprofitArtifactKind[] = [
  "donor_newsletter",
  "grant_snippet",
  "board_update",
  "social_thanks",
];

type Props = {
  recapId: string;
  recapPeriod: string;
  initial: ArtifactRow[];
  approverName: string;
};

export function NonprofitArtifacts({
  recapId,
  recapPeriod,
  initial,
  approverName,
}: Props) {
  const { beginAction, endAction } = useClaudeStatus();
  const [rows, setRows] = React.useState<ArtifactRow[]>(() =>
    sortByOrder(initial),
  );
  const [generating, setGenerating] = React.useState<boolean>(
    initial.length === 0,
  );
  const ranRef = React.useRef(false);

  React.useEffect(() => {
    if (initial.length > 0) return;
    if (ranRef.current) return;
    ranRef.current = true;
    void runGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runGenerate() {
    setGenerating(true);
    beginAction("drafting 4 artifacts");
    try {
      const res = await fetch(`/api/np/recaps/${recapId}/artifacts`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`generate ${res.status}`);
      const data = (await res.json()) as { artifacts: ArtifactRow[] };
      setRows(sortByOrder(data.artifacts));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
      endAction();
    }
  }

  function updateRow(next: ArtifactRow) {
    setRows((prev) =>
      sortByOrder(prev.map((r) => (r.id === next.id ? next : r))),
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <EyebrowLabel className="mb-1">MARKETING ARTIFACTS</EyebrowLabel>
          <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
            Share the {recapPeriod} recap
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
            Four drafts in distinct voices — donor letter, grant snippet,
            board update, social thanks. Each is individually approvable,
            copyable, and downloadable as{" "}
            <code className="font-mono text-[12px]">.md</code>.
          </p>
        </div>
        <Button variant="outline" onClick={runGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-3.5 w-3.5" />
          )}
          Regenerate drafts
        </Button>
      </header>

      {generating && rows.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ArtifactCard
              key={row.id}
              row={row}
              approverName={approverName}
              onUpdate={updateRow}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function sortByOrder(rows: ArtifactRow[]): ArtifactRow[] {
  return rows
    .slice()
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

function SkeletonCard() {
  return (
    <div className="rounded-md border border-hairline bg-paper p-5">
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-4/5" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

function ArtifactCard({
  row,
  approverName,
  onUpdate,
}: {
  row: ArtifactRow;
  approverName: string;
  onUpdate: (next: ArtifactRow) => void;
}) {
  const Icon = ICON[row.kind] ?? Sparkles;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(row.body);
  const [approval, setApproval] = React.useState<AIApprovalState>(() =>
    row.status === "approved"
      ? {
          kind: "approved",
          by: approverName,
          at: relTime(row.approved_at),
          wasEdited: Boolean(row.body_original),
        }
      : row.status === "rejected"
        ? { kind: "rejected", by: approverName, at: "moments ago" }
        : {
            kind: "pending",
            draftedAt: "moments ago",
            model: "claude-sonnet-4-6",
          },
  );

  async function approve() {
    const res = await fetch(`/api/np/artifacts/${row.id}/approve`, {
      method: "POST",
    });
    if (!res.ok) return;
    setApproval({
      kind: "approved",
      by: approverName,
      at: "just now",
      wasEdited: editing,
    });
    onUpdate({ ...row, status: "approved" });
  }

  async function saveEdit() {
    const res = await fetch(`/api/np/artifacts/${row.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    if (!res.ok) return;
    onUpdate({ ...row, body: draft });
    setEditing(false);
    setApproval({
      kind: "edited",
      draftedAt: "just now",
      model: "claude-sonnet-4-6",
    });
  }

  async function reject() {
    await fetch(`/api/np/artifacts/${row.id}/reject`, { method: "POST" });
    setApproval({ kind: "rejected", by: approverName, at: "just now" });
    onUpdate({ ...row, status: "rejected" });
  }

  async function copy() {
    await navigator.clipboard.writeText(row.body);
    toast.success(
      `Copied ${NONPROFIT_ARTIFACT_LABEL[row.kind]} to clipboard`,
    );
  }

  function download() {
    const blob = new Blob([row.body], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.kind}-${row.recap_id}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${a.download}`);
  }

  const words = (row.body.match(/\S+/g) ?? []).length;
  const chars = row.body.length;

  return (
    <article className="rounded-md border border-hairline bg-paper p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-ink-subtle" aria-hidden />
          <h3 className="text-[14px] font-medium text-ink">
            {NONPROFIT_ARTIFACT_LABEL[row.kind]}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {HELPER[row.kind]}
          </span>
        </div>
        <div className="font-mono text-[10px] text-ink-faint">
          {row.kind === "social_thanks"
            ? `${chars} chars`
            : `${words} words`}
        </div>
      </header>

      {row.kind === "social_thanks" ? (
        <SocialPreview
          text={row.body}
          editing={editing}
          draft={draft}
          setDraft={setDraft}
        />
      ) : row.kind === "board_update" ? (
        <BoardPreview
          text={row.body}
          editing={editing}
          draft={draft}
          setDraft={setDraft}
        />
      ) : (
        <ProsePreview
          text={row.body}
          editing={editing}
          draft={draft}
          setDraft={setDraft}
        />
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-3">
        <Button size="sm" variant="ghost" onClick={copy}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={download}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Download .md
        </Button>
        <div className="ml-auto min-w-[260px]">
          <AIApprovalBar
            className="border-0 bg-transparent p-0"
            state={
              editing
                ? {
                    kind: "edited",
                    draftedAt: "just now",
                    model: "claude-sonnet-4-6",
                  }
                : approval
            }
            onApprove={approve}
            onEditStart={() => {
              setEditing(true);
              setDraft(row.body);
            }}
            onEditCancel={() => {
              setEditing(false);
              setDraft(row.body);
            }}
            onEditSave={saveEdit}
            onReject={reject}
          />
        </div>
      </div>
    </article>
  );
}

function SocialPreview({
  text,
  editing,
  draft,
  setDraft,
}: {
  text: string;
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
}) {
  if (editing) {
    return (
      <Textarea
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={280}
        className="font-mono text-[13px] leading-[1.55]"
      />
    );
  }
  return (
    <div className="rounded-md border border-hairline bg-mist px-4 py-3">
      <p className="text-[14px] leading-[1.55] text-ink">{text}</p>
    </div>
  );
}

function BoardPreview({
  text,
  editing,
  draft,
  setDraft,
}: {
  text: string;
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
}) {
  if (editing) {
    return (
      <Textarea
        rows={9}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="text-[14px] leading-[1.6]"
      />
    );
  }
  return (
    <div className="rounded-md border border-hairline bg-mist px-4 py-3">
      <p className="whitespace-pre-line text-[14px] leading-[1.6] text-ink">
        {text}
      </p>
    </div>
  );
}

function ProsePreview({
  text,
  editing,
  draft,
  setDraft,
}: {
  text: string;
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
}) {
  if (editing) {
    return (
      <Textarea
        rows={9}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="text-[14px] leading-[1.6]"
      />
    );
  }
  return (
    <div className="rounded-md border border-hairline bg-mist px-4 py-3">
      <p className="whitespace-pre-line text-[14px] leading-[1.6] text-ink">
        {text}
      </p>
    </div>
  );
}

function relTime(iso?: string | null): string {
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
