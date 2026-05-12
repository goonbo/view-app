import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowRight, ExternalLink } from "lucide-react";
import { db } from "@/db/client";
import { diligenceDocuments, nonprofitPartners } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { ConcernFlag, type ConcernLevel } from "@/components/diligence/ConcernFlag";

type Props = { params: Promise<{ id: string }> };

const STATUS_TONE: Record<string, StatusPillTone> = {
  vetted: "success",
  in_diligence: "info",
  draft: "neutral",
  archived: "neutral",
  concern: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  vetted: "Vetted",
  in_diligence: "In diligence",
  draft: "Draft",
  archived: "Archived",
  concern: "Concern",
};

export default async function PartnerDetailPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const rows = await db
    .select({ partner: nonprofitPartners, diligence: diligenceDocuments })
    .from(nonprofitPartners)
    .leftJoin(
      diligenceDocuments,
      eq(diligenceDocuments.partnerId, nonprofitPartners.id),
    )
    .where(eq(nonprofitPartners.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  const p = row.partner;
  const d = row.diligence;
  const concern = (d?.concernLevel as ConcernLevel | null) ?? null;

  return (
    <div className="space-y-8">
      <div>
        <EyebrowLabel className="mb-2">PARTNER · {formatEin(p.ein)}</EyebrowLabel>
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="font-sans text-[24px] font-medium leading-[1.2] tracking-tight text-ink">
              {p.commonName}
            </h1>
            <p className="mt-1 text-[14px] leading-[1.5] text-ink-subtle">
              {p.legalName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"}>
                {STATUS_LABEL[p.status] ?? p.status}
              </StatusPill>
              {concern && <ConcernFlag level={concern} />}
              {p.matchEligible && <StatusPill tone="info">Match-eligible</StatusPill>}
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href={`/partners/${p.id}/diligence`}>
              View diligence
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-md border border-hairline bg-paper px-5 py-4">
        <Field label="EIN" mono>
          {formatEin(p.ein)}
        </Field>
        <Field label="Location">{p.location ?? "—"}</Field>
        <Field label="Mission" full>
          {p.mission ?? "—"}
        </Field>
        <Field label="Cause areas">
          {p.causeAreas.length ? p.causeAreas.join(" / ") : "—"}
        </Field>
        <Field label="Website">
          {p.website ? (
            <a
              href={p.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              {p.website.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : (
            "—"
          )}
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
  full,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd
        className={mono ? "font-mono text-[13px] text-ink" : "text-[14px] text-ink"}
      >
        {children}
      </dd>
    </div>
  );
}

function formatEin(raw: string): string {
  const c = raw.replace(/-/g, "");
  if (c.length !== 9) return c;
  return `${c.slice(0, 2)}-${c.slice(2)}`;
}
