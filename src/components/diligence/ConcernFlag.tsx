import { Check, AlertTriangle, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConcernLevel = "low" | "medium" | "high";

type ConcernFlagProps = {
  level: ConcernLevel;
  className?: string;
};

const COPY: Record<ConcernLevel, string> = {
  low: "Low concern",
  medium: "Medium concern",
  high: "High concern",
};

/**
 * Low / Medium / High pill. Color reinforces; the text is the primary signal
 * per the brief's "color is reinforcing; text is primary signal" guideline.
 */
export function ConcernFlag({ level, className }: ConcernFlagProps) {
  const Icon = level === "low" ? Check : level === "medium" ? AlertTriangle : AlertOctagon;
  const tone =
    level === "low"
      ? "bg-green-50 text-success border-green-200"
      : level === "medium"
        ? "bg-amber-50 text-warning border-amber-200"
        : "bg-red-50 text-danger border-red-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "font-mono text-[11px] leading-none font-medium uppercase tracking-wider",
        tone,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {COPY[level]}
    </span>
  );
}

/**
 * Small dot variant used inside Discover/Partners cards next to nonprofit
 * names — green/amber/red 6px circle, no text.
 */
export function ConcernDot({ level, className }: ConcernFlagProps) {
  const tone =
    level === "low"
      ? "bg-success"
      : level === "medium"
        ? "bg-warning"
        : "bg-danger";
  return (
    <span
      aria-label={COPY[level]}
      title={COPY[level]}
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", tone, className)}
    />
  );
}
