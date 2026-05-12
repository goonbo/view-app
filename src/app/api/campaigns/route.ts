import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, donationCampaigns, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = {
  title: string;
  story: string;
  goal_amount: number;
  starts_at: string;
  ends_at: string;
  giving_ladder: { amount: number; description: string }[];
  cause_areas?: string[];
  ai_brief?: string;
  ai_brief_original?: string;
};

export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json({ error: "Nonprofit workspace required" }, { status: 403 });
  }
  const body = (await req.json()) as Body;
  if (!body.title || !body.starts_at || !body.ends_at || !body.goal_amount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [created] = await db
    .insert(donationCampaigns)
    .values({
      nonprofitWorkspaceId: ws.id,
      title: body.title,
      story: body.story,
      goalAmount: body.goal_amount.toFixed(2),
      startsAt: new Date(body.starts_at),
      endsAt: new Date(body.ends_at),
      causeAreas: body.cause_areas ?? ws.causeAreas,
      givingLadder: body.giving_ladder ?? [],
      aiBrief: body.ai_brief,
      aiBriefOriginal: body.ai_brief_original ?? body.ai_brief,
      aiBriefApproved: true,
      status: "open",
    })
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
    action: "campaign.created",
    targetType: "donation_campaign",
    targetId: created.id,
    payload: { title: created.title, goal: body.goal_amount },
  });

  return NextResponse.json({ campaign: created });
}
