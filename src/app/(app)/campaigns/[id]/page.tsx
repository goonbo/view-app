import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import {
  donationCampaigns,
  donations,
  matchPolicies,
  nonprofitPartners,
  workspaces,
} from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { SourceMarker } from "@/components/shared/SourceMarker";
import { StatusPill } from "@/components/shared/StatusPill";
import {
  CampaignLiveProgress,
  type CampaignProgressPayload,
} from "@/components/campaigns/CampaignLiveProgress";
import { SimulateDonationModal } from "@/components/campaigns/SimulateDonationModal";
import { isDemoMode } from "@/lib/data-mode";

type Props = { params: Promise<{ id: string }> };

export default async function CampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();

  const [campaign] = await db
    .select()
    .from(donationCampaigns)
    .where(eq(donationCampaigns.id, id))
    .limit(1);
  if (!campaign) notFound();

  // Access check:
  // - Nonprofit workspace: must own the campaign
  // - Corporate workspace: must have a vetted partner relationship with
  //   the nonprofit who owns the campaign
  const isOwner = ws.type === "nonprofit" && ws.id === campaign.nonprofitWorkspaceId;
  let partner: { commonName: string; matchEligible: boolean; partnerId: string } | null = null;
  if (ws.type === "corporate") {
    const [row] = await db
      .select({
        commonName: nonprofitPartners.commonName,
        matchEligible: nonprofitPartners.matchEligible,
        partnerId: nonprofitPartners.id,
        status: nonprofitPartners.status,
      })
      .from(nonprofitPartners)
      .where(
        and(
          eq(nonprofitPartners.corporateWorkspaceId, ws.id),
          eq(nonprofitPartners.nonprofitWorkspaceId, campaign.nonprofitWorkspaceId),
        ),
      )
      .limit(1);
    if (!row || row.status !== "vetted") redirect("/campaigns");
    partner = row;
  } else if (!isOwner) {
    redirect("/campaigns");
  }

  // Pull initial progress payload server-side so the page hydrates with
  // the right state immediately (no flash of zero).
  const [totals] = await db
    .select({
      total_amount: sql<string>`COALESCE(SUM(${donations.amount}), 0)`,
      total_match: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)`,
      donor_count: sql<string>`COUNT(DISTINCT ${donations.employeeEmail})`,
    })
    .from(donations)
    .where(eq(donations.campaignId, campaign.id));
  const recent = await db
    .select()
    .from(donations)
    .where(eq(donations.campaignId, campaign.id))
    .orderBy(desc(donations.createdAt))
    .limit(10);

  // For the nonprofit side, map corporate_workspace_id → name so we can
  // render "Match from {Acme Robotics}" source pills.
  const corporateNameById: Record<string, string> = {};
  if (ws.type === "nonprofit") {
    const ids = Array.from(new Set(recent.map((d) => d.corporateWorkspaceId)));
    if (ids.length) {
      const rows = await db
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(sql`${workspaces.id} IN ${ids}`);
      for (const r of rows) corporateNameById[r.id] = r.name;
    }
  }

  // Find eligible match policies for this campaign + partner (corporate only)
  let applicablePolicies: { id: string; name: string; ratio: number }[] = [];
  if (ws.type === "corporate" && partner) {
    const candidates = await db
      .select()
      .from(matchPolicies)
      .where(
        and(
          eq(matchPolicies.corporateWorkspaceId, ws.id),
          eq(matchPolicies.status, "active"),
        ),
      );
    applicablePolicies = candidates
      .filter((p) => (p.eligiblePartnerIds as string[]).includes(partner.partnerId))
      .map((p) => ({ id: p.id, name: p.name, ratio: Number(p.matchRatio) }));
  }

  const initial: CampaignProgressPayload = {
    campaign: {
      id: campaign.id,
      title: campaign.title,
      goal_amount: Number(campaign.goalAmount),
      status: campaign.status,
    },
    totals: {
      raised: Number(totals.total_amount) + Number(totals.total_match),
      donations_amount: Number(totals.total_amount),
      match_amount: Number(totals.total_match),
      donor_count: Number(totals.donor_count),
    },
    recent: recent.map((d) => ({
      id: d.id,
      employee_name: d.employeeName,
      amount: Number(d.amount),
      match_amount: Number(d.matchAmount),
      corporate_workspace_id: d.corporateWorkspaceId,
      status: d.status,
      created_at: d.createdAt.toISOString(),
    })),
  };

  const ladder = (campaign.givingLadder ?? []) as { amount: number; description: string }[];
  const ownerName = partner?.commonName;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Campaigns
        </Link>
        <EyebrowLabel className="mt-2 mb-1">DONATION CAMPAIGN</EyebrowLabel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-sans text-[24px] font-medium leading-[1.2] tracking-tight text-ink">
              {campaign.title}
            </h1>
            {ws.type === "corporate" && ownerName && (
              <p className="mt-1 text-[14px] leading-[1.5] text-ink-subtle">
                <SourceMarker origin="nonprofit" fromName={ownerName} className="mr-2" />
                published this campaign
              </p>
            )}
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {formatDate(campaign.startsAt)} – {formatDate(campaign.endsAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone={campaign.status === "open" ? "info" : "neutral"}>
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </StatusPill>
            {ws.type === "corporate" && isDemoMode() && (
              <SimulateDonationModal campaignId={campaign.id} campaignTitle={campaign.title} />
            )}
          </div>
        </div>
      </div>

      {/* Story (corporate sees source pill) */}
      {campaign.story && (
        <section className="rounded-md border border-hairline bg-paper p-5">
          <div className="mb-2 flex items-center gap-1.5">
            <EyebrowLabel>STORY</EyebrowLabel>
            {ws.type === "corporate" && <SourceMarker origin="nonprofit" />}
          </div>
          <p className="whitespace-pre-line text-[14px] leading-[1.65] text-ink">
            {campaign.story}
          </p>
        </section>
      )}

      {/* Live progress + recent donations (polled) */}
      <CampaignLiveProgress
        campaignId={campaign.id}
        goalAmount={Number(campaign.goalAmount)}
        initial={initial}
        showMatchSource={ws.type === "nonprofit"}
        corporateNameById={corporateNameById}
      />

      {/* Giving ladder */}
      {ladder.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <EyebrowLabel>GIVING LADDER</EyebrowLabel>
            {ws.type === "corporate" && <SourceMarker origin="nonprofit" />}
          </div>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ladder.map((tier, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-paper px-4 py-3"
              >
                <span className="font-mono text-[16px] font-medium text-ink">
                  ${tier.amount.toLocaleString()}
                </span>
                <span className="flex-1 text-[13px] text-ink-subtle">{tier.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Applicable match policies (corporate only) */}
      {ws.type === "corporate" && (
        <section className="rounded-md border border-hairline bg-paper p-5">
          <EyebrowLabel className="mb-3">MATCHING</EyebrowLabel>
          {applicablePolicies.length === 0 ? (
            <p className="text-[13px] text-ink-subtle">
              No active match policy applies. {" "}
              <Link href="/matching/new" className="text-accent hover:underline">
                Create one
              </Link>{" "}
              to enable donation matching.
            </p>
          ) : (
            <ul className="space-y-2">
              {applicablePolicies.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-mist px-3 py-2"
                >
                  <Link href={`/matching/${p.id}`} className="text-[14px] text-ink hover:underline">
                    {p.name}
                  </Link>
                  <span className="font-mono text-[12px] text-accent">{p.ratio.toFixed(1)}× match</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
