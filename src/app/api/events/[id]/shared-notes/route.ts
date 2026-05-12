import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, events, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { shared_notes: string };

/**
 * Cross-tenant write. Both the nonprofit owner and any corporate partner
 * with a vetted relationship can edit `events.shared_notes`. This is the
 * primary surface for "the bidirectional architecture is the moat."
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Nonprofit owner OR a corporate workspace already activating it.
  const owns = ws.type === "nonprofit" && ev.nonprofitWorkspaceId === ws.id;
  const activated = ws.type === "corporate" && ev.corporateWorkspaceId === ws.id;
  if (!owns && !activated) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(events)
    .set({ sharedNotes: body.shared_notes, updatedAt: new Date() })
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
    action: "event.shared_notes.updated",
    targetType: "event",
    targetId: ev.id,
    payload: { chars: body.shared_notes.length },
  });

  return NextResponse.json({ ok: true });
}
