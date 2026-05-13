import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, nonprofitRecaps } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = {
  opening_para: string;
  partner_contributions: {
    partner_workspace_id: string;
    partner_name: string;
    paragraph: string;
    named_volunteers: string[];
  }[];
  what_worked: string;
  what_drifted: string;
  ask_for_next_quarter: string;
};

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json(
      { error: "Nonprofit workspace required" },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const [updated] = await db
    .update(nonprofitRecaps)
    .set({
      openingPara: body.opening_para,
      partnerContributions: body.partner_contributions,
      whatWorked: body.what_worked,
      whatDrifted: body.what_drifted,
      askForNextQuarter: body.ask_for_next_quarter,
      status: "awaiting_approval",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(nonprofitRecaps.id, id),
        eq(nonprofitRecaps.nonprofitWorkspaceId, ws.id),
      ),
    )
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorKind: "claude",
    action: "nonprofit_recap.generated",
    targetType: "nonprofit_recap",
    targetId: updated.id,
    payload: { period: updated.period, partner_count: body.partner_contributions.length },
  });

  return NextResponse.json({ ok: true });
}
