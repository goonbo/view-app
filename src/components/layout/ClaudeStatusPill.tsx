"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ClaudeStatus =
  | { kind: "idle" }
  | { kind: "active"; action: string; startedAt: number };

type ClaudeStatusPillProps = {
  status: ClaudeStatus;
  /** When collapsed, show icon-only; tooltip carries the full label. */
  compact?: boolean;
  onClick?: () => void;
};

/**
 * Idle  → "Claude · ready"
 * Active → "Claude is {action} · {timer}s" with subtle pulse on the sparkle.
 *
 * Click opens the thinking panel modal (wired by parent).
 */
export function ClaudeStatusPill({
  status,
  compact = false,
  onClick,
}: ClaudeStatusPillProps) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (status.kind !== "active") {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(Math.floor((Date.now() - status.startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const isActive = status.kind === "active";
  const label = isActive
    ? `Claude is ${status.action} · ${elapsed}s`
    : "Claude · ready";

  const pill = (
    <button
      type="button"
      onClick={onClick}
      disabled={!isActive}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-paper",
        "px-2 py-1 font-mono text-[11px] leading-none text-ink-subtle",
        isActive
          ? "border-[var(--accent-soft)] cursor-pointer hover:bg-[var(--accent-soft)]"
          : "border-hairline cursor-default",
        compact && "px-1.5",
      )}
    >
      <Sparkles
        className={cn(
          "h-3 w-3 shrink-0 text-accent-cyan",
          isActive && "animate-pulse",
        )}
        aria-hidden
      />
      {!compact && <span className="truncate">{label}</span>}
    </button>
  );

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{pill}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return pill;
}
