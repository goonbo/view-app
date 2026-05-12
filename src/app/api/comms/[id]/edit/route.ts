import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, commsDrafts, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { body: string; subject?: string };

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json()) as Body;
  const [existing] = await db
    .select()
    .from(commsDrafts)
    .where(eq(commsDrafts.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(commsDrafts)
    .set({
      body: body.body,
      subject: body.subject ?? existing.subject,
      bodyOriginal: existing.bodyOriginal ?? existing.body,
    })
    .where(eq(commsDrafts.id, id));

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "comms.edited",
    targetType: "comms_draft",
    targetId: id,
    payload: { event_id: existing.eventId, kind: existing.kind, chars: body.body.length },
  });

  return NextResponse.json({ ok: true });
}
