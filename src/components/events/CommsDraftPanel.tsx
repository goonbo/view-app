"use client";

import * as React from "react";
import { Mail, MessageCircle, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AIApprovalBar, type AIApprovalState } from "@/components/shared/AIApprovalBar";

export type CommsKind = "email" | "slack" | "calendar";

export type CommsDraftRow = {
  id: string;
  kind: CommsKind;
  subject: string | null;
  body: string;
  bodyOriginal?: string | null;
  status: "draft" | "approved" | "rejected" | "sent";
};

type Props = {
  initial: CommsDraftRow;
  onApproved?: () => void;
  onRejected?: () => void;
  approverName: string;
};

const ICON: Record<CommsKind, typeof Mail> = {
  email: Mail,
  slack: MessageCircle,
  calendar: Calendar,
};

const LABEL: Record<CommsKind, string> = {
  email: "Email",
  slack: "Slack",
  calendar: "Calendar invite",
};

export function CommsDraftPanel({ initial, onApproved, onRejected, approverName }: Props) {
  const [row, setRow] = React.useState(initial);
  const [editing, setEditing] = React.useState(false);
  const [editSubject, setEditSubject] = React.useState(initial.subject ?? "");
  const [editBody, setEditBody] = React.useState(initial.body);
  const [approval, setApproval] = React.useState<AIApprovalState>(() =>
    initial.status === "approved"
      ? { kind: "approved", by: approverName, at: "moments ago", wasEdited: !!initial.bodyOriginal && initial.bodyOriginal !== initial.body }
      : initial.status === "rejected"
        ? { kind: "rejected", by: approverName, at: "moments ago" }
        : { kind: "pending", draftedAt: "moments ago", model: "claude-sonnet-4-6" },
  );

  const Icon = ICON[row.kind];

  async function handleApprove() {
    const res = await fetch(`/api/comms/${row.id}/approve`, { method: "POST" });
    if (!res.ok) return;
    setRow({ ...row, status: "approved" });
    setApproval({
      kind: "approved",
      by: approverName,
      at: "just now",
      wasEdited: approval.kind === "edited" || !!row.bodyOriginal && row.bodyOriginal !== row.body,
    });
    onApproved?.();
  }

  async function handleEditSave() {
    const res = await fetch(`/api/comms/${row.id}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody, subject: row.kind === "email" ? editSubject : undefined }),
    });
    if (!res.ok) return;
    setRow({ ...row, body: editBody, subject: row.kind === "email" ? editSubject : row.subject });
    setEditing(false);
    setApproval({ kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" });
  }

  async function handleReject(reason: string) {
    const res = await fetch(`/api/comms/${row.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) return;
    setRow({ ...row, status: "rejected" });
    setApproval({ kind: "rejected", by: approverName, at: "just now", reason });
    onRejected?.();
  }

  return (
    <article className="flex h-full flex-col rounded-md border border-hairline bg-paper p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
          <Icon className="h-3 w-3" aria-hidden />
          {LABEL[row.kind]}
        </div>
        <span className="font-mono text-[10px] text-ink-faint">
          {row.kind === "email" ? `${(row.body || "").split(/\s+/).filter(Boolean).length} words` : `${(row.body || "").length} chars`}
        </span>
      </header>

      <div className="flex-1 space-y-3">
        {row.kind === "email" && (
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Subject
            </div>
            {editing ? (
              <Input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="h-9 text-[14px]"
              />
            ) : (
              <p className="text-[14px] font-medium text-ink">{row.subject}</p>
            )}
          </div>
        )}
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {row.kind === "email" ? "Body" : row.kind === "slack" ? "Message" : "Description"}
          </div>
          {editing ? (
            <Textarea
              rows={row.kind === "email" ? 9 : 4}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="text-[13px] leading-[1.55]"
            />
          ) : (
            <p className="whitespace-pre-line text-[13px] leading-[1.55] text-ink">
              {row.body}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <AIApprovalBar
          state={editing ? { kind: "edited", draftedAt: "just now", model: "claude-sonnet-4-6" } : approval}
          onApprove={handleApprove}
          onEditStart={() => {
            setEditing(true);
            setEditBody(row.body);
            setEditSubject(row.subject ?? "");
          }}
          onEditCancel={() => {
            setEditing(false);
            setEditBody(row.body);
            setEditSubject(row.subject ?? "");
          }}
          onEditSave={handleEditSave}
          onReject={handleReject}
        />
      </div>
    </article>
  );
}
