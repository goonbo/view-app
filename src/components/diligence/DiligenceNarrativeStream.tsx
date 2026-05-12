import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  streaming: boolean;
  className?: string;
};

/**
 * Streaming narrative paragraph in Blueprint body. While streaming, a small
 * "Claude drafted" attribution appears above the paragraph; the trailing
 * caret blinks subtly until the stream completes.
 */
export function DiligenceNarrativeStream({
  text,
  streaming,
  className,
}: Props) {
  return (
    <div className={cn(className)}>
      <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent-cyan">
        <Sparkles className="h-3 w-3" aria-hidden />
        Claude drafted
      </div>
      <p className="font-sans text-[16px] leading-[1.6] text-ink">
        {text}
        {streaming && (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-ink-faint motion-safe:animate-pulse"
          />
        )}
      </p>
    </div>
  );
}
