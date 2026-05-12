import { cn } from "@/lib/utils";

type ThingsToVerifyListProps = {
  items: string[];
  className?: string;
};

/**
 * Three numbered list items in `blueprint/body`. Each item is one sentence —
 * what to verify and why it matters. Number rendered in mono so it doesn't
 * compete with serif heading weight elsewhere on the page.
 */
export function ThingsToVerifyList({
  items,
  className,
}: ThingsToVerifyListProps) {
  return (
    <ol className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[16px] leading-[1.6] text-ink">
          <span
            aria-hidden
            className="mt-[2px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-paper font-mono text-[11px] leading-none text-ink-subtle"
          >
            {i + 1}
          </span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ol>
  );
}
