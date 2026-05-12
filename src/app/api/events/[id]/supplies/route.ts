import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, events, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { supplies: string[] };

/**
 * Supplies are the nonprofit's source of truth — only the nonprofit owner
 * can write them. Corporate side reads via the polling endpoint.
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json({ error: "Nonprofit workspace required" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ev.nonprofitWorkspaceId !== ws.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supplies = (body.supplies ?? [])
    .map((s) => s.trim())
    .filter(Boolean);

  await db
    .update(events)
    .set({ supplies, updatedAt: new Date() })
    .where(eq(events.id, ev.id));

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "event.supplies.updated",
    targetType: "event",
    targetId: ev.id,
    payload: { count: supplies.length },
  });

  return NextResponse.json({ ok: true, supplies });
}
