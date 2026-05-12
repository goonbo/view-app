import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type SourceMarkerProps = {
  origin: "corporate" | "nonprofit" | "claude";
  fromName?: string;
  className?: string;
};

/**
 * Universal "this came from elsewhere" credit. Used pervasively to make
 * the bidirectional architecture visible at every glance.
 *
 * - corporate → cyan dot
 * - nonprofit → green dot
 * - claude    → cyan sparkle
 */
export function SourceMarker({
  origin,
  fromName,
  className,
}: SourceMarkerProps) {
  const dotColor =
    origin === "nonprofit"
      ? "bg-accent-green"
      : "bg-accent-cyan";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 align-middle",
        className,
      )}
    >
      {origin === "claude" ? (
        <Sparkles
          className="h-3 w-3 text-accent-cyan"
          aria-hidden
        />
      ) : (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
          aria-hidden
        />
      )}
      {fromName && (
        <span className="font-mono text-[11px] leading-[1.4] text-ink-faint">
          {fromName}
        </span>
      )}
    </span>
  );
}
