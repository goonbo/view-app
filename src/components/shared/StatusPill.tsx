import { cn } from "@/lib/utils";

export type StatusPillTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

type StatusPillProps = {
  tone?: StatusPillTone;
  children: React.ReactNode;
  className?: string;
};

const TONE_STYLES: Record<StatusPillTone, string> = {
  neutral: "bg-mist text-ink-subtle border-hairline",
  accent: "bg-[var(--accent-soft)] text-accent border-[var(--accent-soft)]",
  success: "bg-green-50 text-success border-green-200",
  warning: "bg-amber-50 text-warning border-amber-200",
  danger: "bg-red-50 text-danger border-red-200",
  info: "bg-cyan-50 text-accent-cyan border-cyan-200",
};

/**
 * Generic mono pill, 11px / 130% leading. Used for status chips, format pills,
 * cause-area tags, concern flags. Color is reinforcing — the text is the
 * primary signal.
 */
export function StatusPill({
  tone = "neutral",
  children,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "font-mono text-[11px] leading-[1.3] font-normal",
        TONE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
