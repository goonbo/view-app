import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, nonprofitRecaps, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json(
      { error: "Nonprofit workspace required" },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);
  if (!primary) return NextResponse.json({ error: "No user" }, { status: 500 });

  const [updated] = await db
    .update(nonprofitRecaps)
    .set({
      status: "approved",
      approvedBy: primary.id,
      approvedAt: new Date(),
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
    actorId: primary.id,
    actorKind: "user",
    action: "nonprofit_recap.approved",
    targetType: "nonprofit_recap",
    targetId: updated.id,
    payload: { period: updated.period },
  });

  return NextResponse.json({ ok: true });
}
