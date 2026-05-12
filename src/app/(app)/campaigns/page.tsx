import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Plus, ArrowRight, Heart } from "lucide-react";
import { db } from "@/db/client";
import {
  donationCampaigns,
  donations,
  nonprofitPartners,
} from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";

const STATUS_TONE: Record<string, StatusPillTone> = {
  open: "info",
  draft: "neutral",
  closed: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  draft: "Draft",
  closed: "Closed",
};

type Row = {
  id: string;
  title: string;
  goal: number;
  status: string;
  startsAt: Date;
  endsAt: Date;
  causeAreas: string[];
  raised: number;
  ownerName?: string;
};

export default async function CampaignsPage() {
  const ws = await getActiveWorkspaceOrThrow();

  let rows: Row[] = [];
  if (ws.type === "nonprofit") {
    const campaigns = await db
      .select()
      .from(donationCampaigns)
      .where(eq(donationCampaigns.nonprofitWorkspaceId, ws.id))
      .orderBy(desc(donationCampaigns.startsAt));

    const raisedRows = campaigns.length
      ? await db
          .select({
            campaign_id: donations.campaignId,
            total: sql<string>`COALESCE(SUM(${donations.amount} + ${donations.matchAmount}), 0)`,
          })
          .from(donations)
          .where(
            inArray(
              donations.campaignId,
              campaigns.map((c) => c.id),
            ),
          )
          .groupBy(donations.campaignId)
      : [];
    const raisedByCampaign = new Map(raisedRows.map((r) => [r.campaign_id, Number(r.total)]));

    rows = campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      goal: Number(c.goalAmount),
      status: c.status,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      causeAreas: c.causeAreas,
      raised: raisedByCampaign.get(c.id) ?? 0,
    }));
  } else {
    // Corporate side: campaigns from vetted partners (regardless of who
    // activated). Reuse the discover pull pattern.
    const partners = await db
      .select({
        nonprofitWorkspaceId: nonprofitPartners.nonprofitWorkspaceId,
        commonName: nonprofitPartners.commonName,
      })
      .from(nonprofitPartners)
      .where(
        and(
          eq(nonprofitPartners.corporateWorkspaceId, ws.id),
          eq(nonprofitPartners.status, "vetted"),
        ),
      );
    const partnerWorkspaceIds = partners
      .map((p) => p.nonprofitWorkspaceId)
      .filter((id): id is string => !!id);
    const partnerNameById = new Map(
      partners.map((p) => [p.nonprofitWorkspaceId ?? "", p.commonName]),
    );

    if (partnerWorkspaceIds.length) {
      // CROSS_WORKSPACE_READ: corporate reads nonprofit-owned campaigns
      // through the vetted partner relationship.
      const campaigns = await db
        .select()
        .from(donationCampaigns)
        .where(
          inArray(donationCampaigns.nonprofitWorkspaceId, partnerWorkspaceIds),
        )
        .orderBy(desc(donationCampaigns.startsAt));
      const raisedRows = campaigns.length
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
                  campaigns.map((c) => c.id),
                ),
              ),
            )
            .groupBy(donations.campaignId)
        : [];
      const raisedByCampaign = new Map(raisedRows.map((r) => [r.campaign_id, Number(r.total)]));
      rows = campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        goal: Number(c.goalAmount),
        status: c.status,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        causeAreas: c.causeAreas,
        raised: raisedByCampaign.get(c.id) ?? 0,
        ownerName: partnerNameById.get(c.nonprofitWorkspaceId),
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <EyebrowLabel className="mb-1">CAMPAIGNS</EyebrowLabel>
          <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
            {ws.type === "nonprofit" ? "Donation campaigns" : "Active campaigns"}
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
            {ws.type === "nonprofit"
              ? "Donation drives you've published. AI-draft a new one from a single sentence."
              : `Donation drives from your vetted partners — ${rows.length} active`}
          </p>
        </div>
        {ws.type === "nonprofit" && (
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="mr-1 h-3.5 w-3.5" />
              New campaign
            </Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-6 py-8 text-center">
          <p className="text-[14px] text-ink-subtle">
            {ws.type === "nonprofit"
              ? "No campaigns yet."
              : "No active campaigns yet — check back when your partners publish."}
          </p>
          {ws.type === "nonprofit" && (
            <Button asChild className="mt-3" size="sm">
              <Link href="/campaigns/new">+ Draft your first campaign</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const pct = Math.min(100, (r.raised / r.goal) * 100);
            return (
              <Link
                key={r.id}
                href={`/campaigns/${r.id}`}
                className="flex flex-col gap-3 rounded-md border border-hairline bg-paper p-5 hover:border-ink-faint"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-medium text-ink">{r.title}</h3>
                    {r.ownerName && (
                      <p className="mt-0.5 text-[12px] text-ink-subtle">{r.ownerName}</p>
                    )}
                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      Through {formatDate(r.endsAt)}
                    </p>
                  </div>
                  <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </StatusPill>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-ink-subtle">
                  <Heart className="h-3 w-3 text-accent" aria-hidden />
                  <span>
                    ${r.raised.toLocaleString()} of ${r.goal.toLocaleString()} goal
                  </span>
                </div>
                <div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-mist">
                    <div className="h-1 bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-end font-mono text-[11px] text-ink-faint">
                  Open
                  <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
