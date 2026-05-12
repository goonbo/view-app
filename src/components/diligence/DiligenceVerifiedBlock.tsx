import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type VerifiedFacts = {
  ein: string;
  legal_name: string;
  common_name?: string;
  address?: string;
  city?: string;
  state?: string;
  ntee_classification?: string;
  ruling_date?: string;
  total_assets?: number;
  mission?: string;
};

type Props = {
  facts: VerifiedFacts;
  className?: string;
};

function formatEin(raw: string): string {
  const clean = raw.replace(/-/g, "");
  if (clean.length !== 9) return clean;
  return `${clean.slice(0, 2)}-${clean.slice(2)}`;
}

function formatRulingDate(raw?: string): string | null {
  if (!raw) return null;
  // ProPublica returns "1982-07-01" — render as "Jul 1982"
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (!m) return raw;
  const [, year, month] = m;
  const monthName = new Date(Number(year), Number(month) - 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  return `${monthName} ${year}`;
}

function formatCurrency(n?: number): string | null {
  if (!n && n !== 0) return null;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n.toLocaleString()}`;
}

/**
 * IRS / 990 / Charity Nav facts block. Subtle 1px hairline border on a
 * white card embedded in the mist Blueprint surface.
 */
export function DiligenceVerifiedBlock({ facts, className }: Props) {
  const fields: Array<{ label: string; value: string | null }> = [
    { label: "EIN", value: formatEin(facts.ein) },
    { label: "Legal name", value: facts.legal_name },
    {
      label: "Location",
      value: [facts.city, facts.state].filter(Boolean).join(", ") || null,
    },
    { label: "NTEE classification", value: facts.ntee_classification ?? null },
    { label: "IRS ruling", value: formatRulingDate(facts.ruling_date) },
    { label: "Total assets", value: formatCurrency(facts.total_assets) },
  ].filter((f) => f.value);

  return (
    <div
      className={cn(
        "rounded-md border border-hairline bg-paper px-5 py-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-success">
        <Check className="h-3 w-3" aria-hidden />
        Verified · ProPublica + IRS
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-2">
        {fields.map((f) => (
          <div key={f.label} className="flex flex-col gap-0.5">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              {f.label}
            </dt>
            <dd
              className={cn(
                "text-ink",
                f.label === "EIN" || f.label === "Total assets"
                  ? "font-mono text-[13px]"
                  : "text-[14px]",
              )}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
      {facts.mission && (
        <p className="mt-4 border-t border-hairline pt-3 text-[14px] leading-[1.5] text-ink-subtle">
          {facts.mission}
        </p>
      )}
    </div>
  );
}

export type FilingSummary = {
  tax_period: number;
  total_revenue: number;
  total_expenses: number;
  program_service_revenue: number;
  executive_comp?: number;
  total_assets: number;
  yoy_revenue_pct: number | null;
  program_revenue_share: number | null;
  flags: { yoy_decline: boolean; low_program_share: boolean };
};

type FilingSummaryBlockProps = {
  summary: FilingSummary;
  className?: string;
};

export function FilingSummaryBlock({
  summary,
  className,
}: FilingSummaryBlockProps) {
  const cells: Array<{
    label: string;
    value: string;
    mono?: boolean;
    flagged?: boolean;
  }> = [
    {
      label: "Total revenue",
      value: formatCurrency(summary.total_revenue) ?? "—",
      mono: true,
    },
    {
      label: "Total expenses",
      value: formatCurrency(summary.total_expenses) ?? "—",
      mono: true,
    },
    {
      label: "Program service revenue",
      value: formatCurrency(summary.program_service_revenue) ?? "—",
      mono: true,
      flagged: summary.flags.low_program_share,
    },
    {
      label: "Senior officer comp",
      value: formatCurrency(summary.executive_comp) ?? "—",
      mono: true,
    },
    {
      label: "Total assets",
      value: formatCurrency(summary.total_assets) ?? "—",
      mono: true,
    },
    {
      label: "YoY revenue",
      value:
        summary.yoy_revenue_pct !== null
          ? `${summary.yoy_revenue_pct >= 0 ? "+" : ""}${summary.yoy_revenue_pct.toFixed(1)}%`
          : "—",
      mono: true,
      flagged: summary.flags.yoy_decline,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-md border border-hairline bg-paper px-5 py-4",
        className,
      )}
    >
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
        FY{summary.tax_period} Form 990
      </div>
      <dl className="grid grid-cols-3 gap-x-6 gap-y-3">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col gap-0.5">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              {c.label}
            </dt>
            <dd
              className={cn(
                c.mono ? "font-mono text-[14px]" : "text-[14px]",
                c.flagged ? "text-warning" : "text-ink",
              )}
            >
              {c.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
