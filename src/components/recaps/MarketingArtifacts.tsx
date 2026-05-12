"use client";

import * as React from "react";
import { Briefcase, MessageSquare, Presentation, Hash, Globe, Copy, Download, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { AIApprovalBar, type AIApprovalState } from "@/components/shared/AIApprovalBar";
import { toast } from "sonner";
import { useClaudeStatus } from "@/lib/claude-status-context";

export type ArtifactKind =
  | "linkedin"
  | "newsletter"
  | "all_hands"
  | "social_short"
  | "csr_page";

export type ArtifactRow = {
  id: string;
  recap_id: string;
  kind: ArtifactKind;
  content_md: string;
  content_md_original?: string | null;
  status: "draft" | "approved" | "rejected";
  approved_at?: string | null;
};

const ICON: Record<ArtifactKind, typeof Briefcase> = {
  linkedin: Briefcase,
  newsletter: MessageSquare,
  all_hands: Presentation,
  social_short: Hash,
  csr_page: Globe,
};

const LABEL: Record<ArtifactKind, string> = {
  linkedin: "LinkedIn post",
  newsletter: "Internal newsletter",
  all_hands: "All-hands bullets",
  social_short: "Social post",
  csr_page: "CSR page paragraph",
};

const HELPER: Record<ArtifactKind, string> = {
  linkedin: "≈ 200 words",
  newsletter: "≈ 100 words",
  all_hands: "5-7 bullets · scannable from the back row",
  social_short: "≤ 280 chars",
  csr_page: "≈ 120 words",
};

type Props = {
  recapId: string;
  recapTitle: string;
  initial: ArtifactRow[];
  approverName: string;
};

export function MarketingArtifacts({ recapId, recapTitle, initial, approverName }: Props) {
  const { beginAction, endAction } = useClaudeStatus();
  const [rows, setRows] = React.useState<ArtifactRow[]>(initial);
  const [generating, setGenerating] = React.useState<boolean>(initial.length === 0);
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
    beginAction("drafting 5 artifacts");
    try {
      const res = await fetch(`/api/recaps/${recapId}/marketing`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`generate ${res.status}`);
      const data = (await res.json()) as { artifacts: ArtifactRow[] };
      setRows(data.artifacts);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
      endAction();
    }
  }

  function updateRow(next: ArtifactRow) {
    setRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <EyebrowLabel className="mb-1">MARKETING ARTIFACTS</EyebrowLabel>
          <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
            Share {recapTitle}
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
            Five drafts in distinct voices. Each is individually approvable, copyable, and
            downloadable as <code className="font-mono text-[12px]">.md</code>.
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
          {Array.from({ length: 5 }).map((_, i) => (
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
  const [draft, setDraft] = React.useState(row.content_md);
  const [approval, setApproval] = React.useState<AIApprovalState>(() =>
    row.status === "approved"
      ? {
          kind: "approved",
          by: approverName,
          at: relTime(row.approved_at),
          wasEdited: Boolean(row.content_md_original),
        }
      : row.status === "rejected"
        ? { kind: "rejected", by: approverName, at: "moments ago" }
        : { kind: "pending", draftedAt: "moments ago", model: "claude-sonnet-4-6" },
  );

  async function approve() {
    const res = await fetch(`/api/artifacts/${row.id}/approve`, { method: "POST" });
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
    const res = await fetch(`/api/artifacts/${row.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_md: draft }),
    });
    if (!res.ok) return;
    onUpdate({ ...row, content_md: draft });
    setEditing(false);
    setApproval({ kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" });
  }

  async function reject() {
    await fetch(`/api/artifacts/${row.id}/reject`, { method: "POST" });
    setApproval({ kind: "rejected", by: approverName, at: "just now" });
    onUpdate({ ...row, status: "rejected" });
  }

  async function copy() {
    await navigator.clipboard.writeText(row.content_md);
    toast.success(`Copied ${LABEL[row.kind]} to clipboard`);
  }

  function download() {
    const blob = new Blob([row.content_md], { type: "text/markdown" });
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

  const words = (row.content_md.match(/\S+/g) ?? []).length;
  const chars = row.content_md.length;

  return (
    <article className="rounded-md border border-hairline bg-paper p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-ink-subtle" aria-hidden />
          <h3 className="text-[14px] font-medium text-ink">{LABEL[row.kind]}</h3>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {HELPER[row.kind]}
          </span>
        </div>
        <div className="font-mono text-[10px] text-ink-faint">
          {row.kind === "social_short" ? `${chars} chars` : `${words} words`}
        </div>
      </header>

      {row.kind === "linkedin" ? (
        <LinkedInPreview text={row.content_md} editing={editing} draft={draft} setDraft={setDraft} />
      ) : row.kind === "social_short" ? (
        <SocialPreview text={row.content_md} editing={editing} draft={draft} setDraft={setDraft} />
      ) : row.kind === "all_hands" ? (
        <AllHandsPreview text={row.content_md} editing={editing} draft={draft} setDraft={setDraft} />
      ) : (
        <ProsePreview text={row.content_md} editing={editing} draft={draft} setDraft={setDraft} />
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
            state={editing ? { kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" } : approval}
            onApprove={approve}
            onEditStart={() => {
              setEditing(true);
              setDraft(row.content_md);
            }}
            onEditCancel={() => {
              setEditing(false);
              setDraft(row.content_md);
            }}
            onEditSave={saveEdit}
            onReject={reject}
          />
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// Per-kind preview renderers

function LinkedInPreview({
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
      <p className="whitespace-pre-line text-[14px] leading-[1.6] text-ink">{text}</p>
    </div>
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

function AllHandsPreview({
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
        className="font-mono text-[13px] leading-[1.6]"
      />
    );
  }
  // First line = title, rest = bullets
  const [first, ...rest] = text.split("\n");
  return (
    <div className="rounded-md border border-hairline bg-mist px-4 py-3">
      <div className="mb-3 font-sans text-[18px] font-medium text-ink">{first.trim()}</div>
      <ul className="space-y-1.5">
        {rest
          .filter((l) => l.trim().startsWith("- "))
          .map((b, i) => (
            <li key={i} className="font-mono text-[13px] leading-[1.55] text-ink">
              {b.replace(/^-\s*/, "• ")}
            </li>
          ))}
      </ul>
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
        rows={6}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="text-[14px] leading-[1.6]"
      />
    );
  }
  return (
    <div className="rounded-md border border-hairline bg-mist px-4 py-3">
      <p className="whitespace-pre-line text-[14px] leading-[1.6] text-ink">{text}</p>
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
