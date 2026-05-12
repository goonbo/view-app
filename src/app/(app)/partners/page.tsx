import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus, ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { diligenceDocuments, nonprofitPartners } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";
import { ConcernDot, type ConcernLevel } from "@/components/diligence/ConcernFlag";
import { Placeholder } from "@/components/shared/Placeholder";

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

export default async function PartnersPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") {
    return (
      <Placeholder
        phase="Phase 3"
        title="Partners"
        description="Corporate partners who've vetted your organization. Activity history and contact details."
      />
    );
  }

  const partners = await db
    .select({
      partner: nonprofitPartners,
      diligence: diligenceDocuments,
    })
    .from(nonprofitPartners)
    .leftJoin(
      diligenceDocuments,
      eq(diligenceDocuments.partnerId, nonprofitPartners.id),
    )
    .where(eq(nonprofitPartners.corporateWorkspaceId, ws.id))
    .orderBy(desc(nonprofitPartners.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <EyebrowLabel className="mb-1">PARTNERS</EyebrowLabel>
          <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
            Vetted nonprofit partners
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
            {partners.length} organization{partners.length === 1 ? "" : "s"} ·
            run diligence on a new EIN to add one
          </p>
        </div>
        <Button asChild>
          <Link href="/partners/new">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Vet new partner
          </Link>
        </Button>
      </div>

      {partners.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-6 py-8 text-center">
          <p className="text-[14px] text-ink-subtle">No partners yet.</p>
          <Button asChild className="mt-3" size="sm">
            <Link href="/partners/new">+ Vet your first partner</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline bg-paper">
          {partners.map((row, idx) => {
            const p = row.partner;
            const d = row.diligence;
            const concern = d?.concernLevel as ConcernLevel | null;
            const isLast = idx === partners.length - 1;
            return (
              <Link
                key={p.id}
                href={
                  p.status === "in_diligence" || p.status === "draft"
                    ? `/partners/${p.id}/diligence`
                    : `/partners/${p.id}`
                }
                className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-mist ${
                  isLast ? "" : "border-b border-hairline"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {concern && <ConcernDot level={concern} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium text-ink">
                        {p.commonName}
                      </span>
                      <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </StatusPill>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] leading-[1.4] text-ink-faint">
                      <span>EIN {formatEin(p.ein)}</span>
                      {p.location && <span>· {p.location}</span>}
                      {p.causeAreas.length > 0 && (
                        <span>· {p.causeAreas.join(" / ")}</span>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatEin(raw: string): string {
  const c = raw.replace(/-/g, "");
  if (c.length !== 9) return c;
  return `${c.slice(0, 2)}-${c.slice(2)}`;
}
