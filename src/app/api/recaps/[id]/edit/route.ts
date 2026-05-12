import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, recaps, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { narrative_md: string };

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const [existing] = await db
    .select()
    .from(recaps)
    .where(and(eq(recaps.id, id), eq(recaps.workspaceId, ws.id)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const original = existing.narrativeMdOriginal ?? existing.narrativeMd;
  await db
    .update(recaps)
    .set({ narrativeMd: body.narrative_md, narrativeMdOriginal: original })
    .where(eq(recaps.id, id));

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "recap.edited",
    targetType: "recap",
    targetId: existing.id,
    payload: { chars: body.narrative_md.length },
  });

  return NextResponse.json({ ok: true });
}
