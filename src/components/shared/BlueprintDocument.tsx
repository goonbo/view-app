import { cn } from "@/lib/utils";

type BlueprintDocumentProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Editorial document wrapper used for diligence reports, recaps, and
 * quarterly reviews. Mist background, generous spacing, max-width 720px
 * for prose readability.
 *
 * Per the pairing rule in <design_system>: on mist, body meta text must
 * use `text-ink-subtle`, not `text-ink-muted` (contrast would drop below
 * the WCAG body-text floor). Document accordingly inside this surface.
 */
export function BlueprintDocument({
  children,
  className,
}: BlueprintDocumentProps) {
  return (
    <div className="min-h-[calc(100vh-44px)] bg-mist">
      <div
        className={cn(
          "mx-auto w-full max-w-[760px] px-10 py-16",
          "[&_p]:font-sans [&_p]:text-base [&_p]:leading-[1.6] [&_p]:text-ink",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

type BlueprintHeroProps = {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
};

/**
 * Hero header used by Blueprint documents — Instrument Serif display
 * type, mono eyebrow + meta. Single largest type moment on the page.
 */
export function BlueprintHero({
  eyebrow,
  title,
  subtitle,
  meta,
  className,
}: BlueprintHeroProps) {
  return (
    <header className={cn("mb-10", className)}>
      {eyebrow && (
        <div className="mb-5 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
          {eyebrow}
        </div>
      )}
      <h1 className="font-serif text-[64px] leading-[1.05] tracking-tighter text-ink">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-4 max-w-[58ch] text-[18px] leading-[1.6] text-ink-subtle">
          {subtitle}
        </p>
      )}
      {meta && (
        <div className="mt-5 font-mono text-[11px] leading-[1.4] text-ink-subtle">
          {meta}
        </div>
      )}
    </header>
  );
}

type BlueprintSectionProps = {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function BlueprintSection({
  eyebrow,
  title,
  children,
  className,
}: BlueprintSectionProps) {
  return (
    <section className={cn("mt-12", className)}>
      {eyebrow && (
        <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
          {eyebrow}
        </div>
      )}
      {title && (
        <h2 className="mb-5 font-serif text-[32px] leading-[1.2] tracking-tight text-ink">
          {title}
        </h2>
      )}
      <div className="space-y-4 text-[16px] leading-[1.6] text-ink">
        {children}
      </div>
    </section>
  );
}
