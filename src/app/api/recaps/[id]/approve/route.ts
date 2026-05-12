import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, recaps, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);
  if (!primary) return NextResponse.json({ error: "No user" }, { status: 500 });

  const [updated] = await db
    .update(recaps)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(recaps.id, id), eq(recaps.workspaceId, ws.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary.id,
    actorKind: "user",
    action: "recap.approved",
    targetType: "recap",
    targetId: updated.id,
    payload: { title: updated.title },
  });

  return NextResponse.json({ ok: true });
}
