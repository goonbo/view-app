import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, diligenceDocuments, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { narrative: string };

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const existing = await db
    .select()
    .from(diligenceDocuments)
    .where(and(eq(diligenceDocuments.id, id), eq(diligenceDocuments.workspaceId, ws.id)))
    .limit(1);
  const doc = existing[0];
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // First edit preserves the original narrative; later edits don't overwrite.
  const original = doc.narrativeOriginal ?? doc.narrative;
  await db
    .update(diligenceDocuments)
    .set({
      narrative: body.narrative,
      narrativeOriginal: original,
      editedAt: new Date(),
    })
    .where(eq(diligenceDocuments.id, id));

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "diligence.edited",
    targetType: "diligence_document",
    targetId: doc.id,
    payload: { narrative_chars: body.narrative.length },
  });

  return NextResponse.json({ ok: true });
}
