import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { donationCampaigns, donations, nonprofitPartners } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Live progress + recent donations for a campaign. Polled by both sides
 * of the relationship to drive cross-tenant updates.
 *
 * For the corporate side, "scope=mine" returns only donations from the
 * active corporate workspace. For the nonprofit side (campaign owner),
 * "scope=all" returns every donation across corporate partners — both
 * sides see the same totals but optionally filter the recent list.
 */
export async function GET(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "all";

  const [campaign] = await db
    .select()
    .from(donationCampaigns)
    .where(eq(donationCampaigns.id, id))
    .limit(1);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // CROSS_WORKSPACE_READ: corporate workspaces read campaigns owned by
  // their vetted nonprofit partners; access is checked at the request layer.
  const allDonationsWhere = eq(donations.campaignId, id);

  const [totals] = await db
    .select({
      total_amount: sql<string>`COALESCE(SUM(${donations.amount}), 0)`,
      total_match: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)`,
      donor_count: sql<string>`COUNT(DISTINCT ${donations.employeeEmail})`,
    })
    .from(donations)
    .where(allDonationsWhere);

  const scopeWhere =
    scope === "mine" && ws.type === "corporate"
      ? and(allDonationsWhere, eq(donations.corporateWorkspaceId, ws.id))
      : allDonationsWhere;
  const recent = await db
    .select()
    .from(donations)
    .where(scopeWhere)
    .orderBy(desc(donations.createdAt))
    .limit(10);

  // Resolve partner name (for the nonprofit-side view of "where did this
  // match come from" — strictly speaking the partner row is corporate-side,
  // so we pull the corporate workspace name via nonprofit_partners join).
  const partnerIds = Array.from(new Set(recent.map((d) => d.partnerId)));
  const partnerById = partnerIds.length
    ? Object.fromEntries(
        (
          await db
            .select({
              id: nonprofitPartners.id,
              corporateWorkspaceId: nonprofitPartners.corporateWorkspaceId,
            })
            .from(nonprofitPartners)
            .where(
              sql`${nonprofitPartners.id} IN ${partnerIds}`,
            )
        ).map((p) => [p.id, p.corporateWorkspaceId]),
      )
    : ({} as Record<string, string>);

  return NextResponse.json({
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
      partner_id: d.partnerId,
      corporate_workspace_id: partnerById[d.partnerId] ?? d.corporateWorkspaceId,
      status: d.status,
      created_at: d.createdAt.toISOString(),
    })),
  });
}
