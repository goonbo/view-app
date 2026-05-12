import { redirect } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  diligenceDocuments,
  donationCampaigns,
  donations,
  events,
  nonprofitPartners,
} from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { DiscoverFilters } from "@/components/discover/DiscoverFilters";
import { DiscoverCard, type DiscoverItem } from "@/components/discover/DiscoverCard";
import type { ConcernLevel } from "@/components/diligence/ConcernFlag";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");
  const params = await searchParams;
  const kind = (asString(params.kind) ?? "all") as "all" | "events" | "campaigns";
  const time = (asString(params.time) ?? "any") as "any" | "this-month";
  const cause = asString(params.cause) ?? "all";

  // Pull all vetted partners + their concern levels in one go.
  const partnerRows = await db
    .select({
      partnerId: nonprofitPartners.id,
      partnerNonprofitWorkspaceId: nonprofitPartners.nonprofitWorkspaceId,
      partnerName: nonprofitPartners.commonName,
      partnerStatus: nonprofitPartners.status,
      concern: diligenceDocuments.concernLevel,
    })
    .from(nonprofitPartners)
    .leftJoin(
      diligenceDocuments,
      eq(diligenceDocuments.partnerId, nonprofitPartners.id),
    )
    .where(
      and(
        eq(nonprofitPartners.corporateWorkspaceId, ws.id),
        eq(nonprofitPartners.status, "vetted"),
      ),
    );

  const vettedWorkspaceIds = partnerRows
    .map((p) => p.partnerNonprofitWorkspaceId)
    .filter((id): id is string => !!id);
  const partnerByWorkspaceId = new Map(
    partnerRows.map((p) => [
      p.partnerNonprofitWorkspaceId ?? "",
      { name: p.partnerName, concern: p.concern as ConcernLevel | null, partnerId: p.partnerId },
    ]),
  );

  let items: DiscoverItem[] = [];
  if (vettedWorkspaceIds.length > 0) {
    // CROSS_WORKSPACE_READ: corporate reads nonprofit-owned events through
    // the partner relationship.
    const [evRows, campaignRows] = await Promise.all([
      db
        .select()
        .from(events)
        .where(
          and(
            inArray(events.nonprofitWorkspaceId, vettedWorkspaceIds),
            inArray(events.status, ["open", "activated"]),
          ),
        )
        .orderBy(desc(events.startsAt)),
      db
        .select()
        .from(donationCampaigns)
        .where(
          and(
            inArray(donationCampaigns.nonprofitWorkspaceId, vettedWorkspaceIds),
            eq(donationCampaigns.status, "open"),
          ),
        )
        .orderBy(desc(donationCampaigns.endsAt)),
    ]);

    // For campaigns, also fetch raised amount in this corporate workspace
    // (donations + matches) to render progress.
    const raised = campaignRows.length
      ? await db
          .select({
            campaign_id: donations.campaignId,
            total: sql<string>`COALESCE(SUM(${donations.amount} + ${donations.matchAmount}), 0)`,
          })
          .from(donations)
          .where(
            and(
              eq(donations.corporateWorkspaceId, ws.id),
              inArray(
                donations.campaignId,
                campaignRows.map((c) => c.id),
              ),
            ),
          )
          .groupBy(donations.campaignId)
      : [];
    const raisedByCampaign = new Map(raised.map((r) => [r.campaign_id, Number(r.total)]));

    const eventItems: DiscoverItem[] = evRows.map((e) => {
      const p = partnerByWorkspaceId.get(e.nonprofitWorkspaceId);
      return {
        kind: "event",
        id: e.id,
        title: e.title,
        description: e.description ?? "",
        partnerName: p?.name ?? "Partner",
        partnerConcern: p?.concern ?? null,
        format: e.format,
        causeAreas: e.causeAreas,
        capacity: e.capacity,
        startsAt: e.startsAt,
        location: e.location,
        activateHref:
          e.status === "activated"
            ? `/events/${e.id}`
            : `/events/${e.id}/activate`,
        status: e.status,
      };
    });
    const campaignItems: DiscoverItem[] = campaignRows.map((c) => {
      const p = partnerByWorkspaceId.get(c.nonprofitWorkspaceId);
      return {
        kind: "campaign",
        id: c.id,
        title: c.title,
        description: c.story ?? "",
        partnerName: p?.name ?? "Partner",
        partnerConcern: p?.concern ?? null,
        causeAreas: c.causeAreas,
        goalAmount: Number(c.goalAmount),
        raisedAmount: raisedByCampaign.get(c.id) ?? 0,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        activateHref: `/campaigns/${c.id}`,
        status: c.status,
      };
    });
    items = [...eventItems, ...campaignItems];
  }

  const filtered = items.filter((it) => {
    if (kind === "events" && it.kind !== "event") return false;
    if (kind === "campaigns" && it.kind !== "campaign") return false;
    if (time === "this-month") {
      const now = new Date();
      const oneMonthOut = new Date(now.getTime() + 31 * 86_400_000);
      if (it.startsAt > oneMonthOut) return false;
    }
    if (cause !== "all" && !it.causeAreas.includes(cause)) return false;
    return true;
  });

  // Available cause filters: union of all items' causeAreas.
  const causeSet = new Set<string>();
  for (const it of items) for (const c of it.causeAreas) causeSet.add(c);
  const causes = Array.from(causeSet).sort();
  const vettedPartnerCount = partnerRows.length;

  return (
    <div className="space-y-6">
      <div>
        <EyebrowLabel className="mb-1">DISCOVER FEED</EyebrowLabel>
        <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
          Opportunities from your vetted partners
        </h1>
        <p className="mt-1 font-mono text-[11px] leading-[1.4] text-ink-subtle">
          {filtered.length} of {items.length} opportunit{items.length === 1 ? "y" : "ies"} from
          your {vettedPartnerCount} vetted partner{vettedPartnerCount === 1 ? "" : "s"}
        </p>
      </div>

      <DiscoverFilters causes={causes} />

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-6 py-8 text-center">
          <p className="text-[14px] text-ink-subtle">
            {items.length === 0
              ? "No events or campaigns yet — your vetted partners haven't published anything."
              : "Nothing matches your filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((it) => (
            <DiscoverCard key={`${it.kind}-${it.id}`} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function asString(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}
