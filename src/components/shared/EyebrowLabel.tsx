import { cn } from "@/lib/utils";

type EyebrowLabelProps = {
  children: React.ReactNode;
  className?: string;
  /** Larger UPPERCASE eyebrow with 0.1em tracking. Default 0.06em "small-caps". */
  size?: "sm" | "md";
};

/**
 * Mono UPPERCASE section label, e.g. "PENDING YOUR REVIEW · 5 items".
 * `metric-label` uses size=sm; section eyebrows use size=md.
 */
export function EyebrowLabel({
  children,
  className,
  size = "md",
}: EyebrowLabelProps) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] leading-[1.4] uppercase text-ink-faint",
        size === "md" ? "tracking-wider" : "tracking-wide",
        className,
      )}
    >
      {children}
    </div>
  );
}
