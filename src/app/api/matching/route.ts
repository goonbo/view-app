import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  donations,
  matchPolicies,
  nonprofitPartners,
  users,
} from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = {
  name: string;
  eligible_partner_ids: string[];
  match_ratio: number;
  cap_per_employee: number;
  cap_total?: number | null;
  starts_at: string;
  ends_at: string;
  activate?: boolean;
};

export async function GET() {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }
  const policies = await db
    .select()
    .from(matchPolicies)
    .where(eq(matchPolicies.corporateWorkspaceId, ws.id));

  // Aggregate matched YTD per policy.
  const totals = policies.length
    ? await db
        .select({
          policy_id: donations.matchPolicyId,
          total: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)`,
        })
        .from(donations)
        .where(
          and(
            eq(donations.corporateWorkspaceId, ws.id),
            inArray(
              donations.matchPolicyId,
              policies.map((p) => p.id),
            ),
          ),
        )
        .groupBy(donations.matchPolicyId)
    : [];
  const matchedByPolicy = new Map(totals.map((t) => [t.policy_id, Number(t.total)]));
  return NextResponse.json({
    policies: policies.map((p) => ({
      ...p,
      matched_to_date: matchedByPolicy.get(p.id) ?? 0,
    })),
  });
}

export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }
  const body = (await req.json()) as Body;
  if (!body.name || !body.starts_at || !body.ends_at) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [policy] = await db
    .insert(matchPolicies)
    .values({
      corporateWorkspaceId: ws.id,
      name: body.name,
      eligiblePartnerIds: body.eligible_partner_ids,
      matchRatio: body.match_ratio.toFixed(2),
      capPerEmployee: body.cap_per_employee.toFixed(2),
      capTotal:
        body.cap_total !== null && body.cap_total !== undefined
          ? body.cap_total.toFixed(2)
          : null,
      startsAt: new Date(body.starts_at),
      endsAt: new Date(body.ends_at),
      status: body.activate ? "active" : "draft",
    })
    .returning();

  if (body.activate && body.eligible_partner_ids.length > 0) {
    await db
      .update(nonprofitPartners)
      .set({ matchEligible: true, updatedAt: new Date() })
      .where(
        and(
          eq(nonprofitPartners.corporateWorkspaceId, ws.id),
          inArray(nonprofitPartners.id, body.eligible_partner_ids),
        ),
      );
  }

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: body.activate ? "match_policy.activated" : "match_policy.created",
    targetType: "match_policy",
    targetId: policy.id,
    payload: {
      name: policy.name,
      eligible_partner_ids: body.eligible_partner_ids,
      ratio: body.match_ratio,
    },
  });

  return NextResponse.json({ policy });
}
