import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, nonprofitRecaps, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = { period: string };

/**
 * Creates a nonprofit-side recap in "drafting" state. Client navigates
 * to /np/recap/{id} and opens the SSE stream from there.
 */
export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json(
      { error: "Nonprofit workspace required" },
      { status: 403 },
    );
  }
  const body = (await req.json()) as Body;
  if (!body.period?.trim()) {
    return NextResponse.json({ error: "period is required" }, { status: 400 });
  }

  const [recap] = await db
    .insert(nonprofitRecaps)
    .values({
      nonprofitWorkspaceId: ws.id,
      period: body.period,
      status: "drafting",
      partnerContributions: [],
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
    action: "nonprofit_recap.created",
    targetType: "nonprofit_recap",
    targetId: recap.id,
    payload: { period: body.period },
  });

  return NextResponse.json({ recap });
}
