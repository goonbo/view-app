import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, diligenceDocuments, nonprofitPartners, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { reason?: string };

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const [updated] = await db
    .update(diligenceDocuments)
    .set({
      status: "rejected",
      rejectionReason: body.reason ?? null,
      editedAt: new Date(),
    })
    .where(and(eq(diligenceDocuments.id, id), eq(diligenceDocuments.workspaceId, ws.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Archive the partner — they won't appear in Discover.
  await db
    .update(nonprofitPartners)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(nonprofitPartners.id, updated.partnerId));

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "diligence.rejected",
    targetType: "diligence_document",
    targetId: updated.id,
    payload: { reason: body.reason ?? null },
  });

  return NextResponse.json({ ok: true });
}
