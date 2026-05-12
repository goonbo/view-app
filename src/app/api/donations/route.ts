import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  donationCampaigns,
  donations,
  nonprofitPartners,
  users,
} from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { evaluateMatch } from "@/lib/matching";
import { isDemoMode } from "@/lib/data-mode";

export const runtime = "nodejs";

type Body = {
  campaign_id: string;
  amount: number;
  employee_name: string;
  employee_email: string;
};

/**
 * Simulates a corporate employee donation. Creates a `donations` row,
 * evaluates which active match policy (if any) applies, updates the
 * donation with the match, and writes an audit_log entry.
 *
 * Only available in DEMO_MODE. In production this would be a real
 * payments-backed endpoint.
 */
export async function POST(req: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }

  const body = (await req.json()) as Body;
  if (!body.campaign_id || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Find the campaign + the partner row in this corporate workspace pointing
  // at the campaign's nonprofit workspace.
  const [campaign] = await db
    .select()
    .from(donationCampaigns)
    .where(eq(donationCampaigns.id, body.campaign_id))
    .limit(1);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const [partner] = await db
    .select()
    .from(nonprofitPartners)
    .where(
      and(
        eq(nonprofitPartners.corporateWorkspaceId, ws.id),
        eq(nonprofitPartners.nonprofitWorkspaceId, campaign.nonprofitWorkspaceId),
      ),
    )
    .limit(1);
  if (!partner) {
    return NextResponse.json(
      { error: "No partner relationship — vet this nonprofit first." },
      { status: 400 },
    );
  }

  // Insert donation in `pending` state, then update with match.
  const [donation] = await db
    .insert(donations)
    .values({
      campaignId: campaign.id,
      employeeName: body.employee_name,
      employeeEmail: body.employee_email,
      corporateWorkspaceId: ws.id,
      amount: body.amount.toFixed(2),
      matchAmount: "0.00",
      partnerId: partner.id,
      status: "pending",
    })
    .returning();

  // Evaluate match.
  const match = await evaluateMatch({
    corporateWorkspaceId: ws.id,
    partnerId: partner.id,
    employeeEmail: body.employee_email,
    amount: body.amount,
    at: donation.createdAt,
  });

  const [updated] = await db
    .update(donations)
    .set({
      matchAmount: match.matchAmount.toFixed(2),
      matchPolicyId: match.matchPolicyId,
      status: match.matchAmount > 0 ? "matched" : "completed",
    })
    .where(eq(donations.id, donation.id))
    .returning();

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "donation.simulated",
    targetType: "donation",
    targetId: updated.id,
    payload: {
      campaign_id: campaign.id,
      amount: body.amount,
      match_amount: match.matchAmount,
      match_policy_id: match.matchPolicyId,
    },
  });

  return NextResponse.json({ donation: updated, match });
}
