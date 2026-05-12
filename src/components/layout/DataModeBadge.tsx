import { getDataMode } from "@/lib/data-mode";
import { cn } from "@/lib/utils";

/**
 * Reads DATA_MODE at request time. A viewer always knows which mode the
 * demo is in — fixture (neutral gray) or live (accent color).
 */
export function DataModeBadge() {
  const mode = getDataMode();
  const isLive = mode === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5",
        "font-mono text-[10px] font-medium uppercase tracking-wider",
        isLive
          ? "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-accent"
          : "border-hairline bg-mist text-ink-subtle",
      )}
    >
      {isLive ? "Live data" : "Fixture data"}
    </span>
  );
}
