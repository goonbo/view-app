"use client";

import * as React from "react";
import { Check, Pencil, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AIApprovalState =
  | { kind: "pending"; draftedAt: string; model?: string }
  | { kind: "edited"; draftedAt: string; model?: string }
  | { kind: "approved"; by: string; at: string; wasEdited: boolean }
  | { kind: "rejected"; by: string; at: string; reason?: string };

type AIApprovalBarProps = {
  state: AIApprovalState;
  onApprove?: () => void | Promise<void>;
  onEditStart?: () => void;
  onEditCancel?: () => void;
  onEditSave?: () => void | Promise<void>;
  onReject?: (reason: string) => void | Promise<void>;
  onShowOriginal?: () => void;
  onRegenerate?: () => void;
  className?: string;
};

const META_CLASS = "font-mono text-[11px] leading-[1.4] text-ink-faint";

/**
 * Universal approval bar for any AI-generated artifact in VIEW.
 *
 * The visual signature of the brand promise: "AI as operator, not autopilot."
 * Every AI surface uses this exact component; consistency is the trust.
 */
export function AIApprovalBar({
  state,
  onApprove,
  onEditStart,
  onEditCancel,
  onEditSave,
  onReject,
  onShowOriginal,
  onRegenerate,
  className,
}: AIApprovalBarProps) {
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  if (state.kind === "approved") {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-md border border-hairline",
          "bg-[var(--accent-soft)] px-4 py-2.5",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-accent" aria-hidden />
          <span className={META_CLASS}>
            Approved by {state.by}
            {state.wasEdited ? " · edited from original" : ""} · {state.at}
          </span>
        </div>
        {state.wasEdited && onShowOriginal && (
          <button
            type="button"
            onClick={onShowOriginal}
            className={cn(META_CLASS, "underline-offset-2 hover:underline")}
          >
            Show original
          </button>
        )}
      </div>
    );
  }

  if (state.kind === "rejected") {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-md border border-hairline bg-mist px-4 py-2.5",
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <X className="h-3.5 w-3.5 text-danger" aria-hidden />
          <span className={META_CLASS}>
            Rejected by {state.by} · {state.at}
            {state.reason ? ` — ${state.reason}` : ""}
          </span>
        </div>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className={cn(META_CLASS, "text-accent underline-offset-2 hover:underline")}
          >
            Regenerate
          </button>
        )}
      </div>
    );
  }

  // pending or edited
  const isEdited = state.kind === "edited";
  return (
    <div
      className={cn(
        "rounded-md border border-hairline bg-paper px-4 py-3",
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-accent-cyan" aria-hidden />
        <span className={META_CLASS}>
          {isEdited
            ? `Edited · pending approval · ${state.draftedAt}`
            : `Drafted by Claude${state.model ? ` · ${state.model}` : ""} · ${state.draftedAt}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isEdited ? (
            <>
              <Button size="sm" onClick={onEditSave}>
                Save edits
              </Button>
              <Button size="sm" variant="ghost" onClick={onEditCancel}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={onApprove}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={onEditStart}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            </>
          )}
        </div>
        <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger">
              <X className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="space-y-3">
              <div>
                <div className={cn(META_CLASS, "mb-1.5 uppercase tracking-wide")}>
                  Reason (optional)
                </div>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What's wrong with this draft?"
                  className="text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRejectOpen(false);
                    setReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await onReject?.(reason);
                    setRejectOpen(false);
                    setReason("");
                  }}
                >
                  Submit
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
