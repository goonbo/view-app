import { EyebrowLabel } from "./EyebrowLabel";

type PlaceholderProps = {
  title: string;
  description?: string;
  phase: string;
};

/**
 * Stub used by Phase 1 placeholder pages. Each surface gets a meaningful
 * page title + a marker noting which phase will implement it.
 */
export function Placeholder({ title, description, phase }: PlaceholderProps) {
  return (
    <div className="py-2">
      <EyebrowLabel className="mb-2">{phase}</EyebrowLabel>
      <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-[64ch] text-[14px] leading-[1.6] text-ink-subtle">
          {description}
        </p>
      )}
      <div className="mt-6 rounded-md border border-dashed border-hairline bg-mist px-4 py-3 font-mono text-[11px] leading-[1.4] text-ink-faint">
        Surface implemented in {phase.toLowerCase()}.
      </div>
    </div>
  );
}
