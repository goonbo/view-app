import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, diligenceDocuments, nonprofitPartners, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }

  const { id } = await ctx.params;

  // Use the workspace's primary user as the approver — proper auth is TODO.
  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);
  if (!primary) return NextResponse.json({ error: "No user in workspace" }, { status: 500 });

  const [updated] = await db
    .update(diligenceDocuments)
    .set({
      status: "approved",
      approvedBy: primary.id,
      approvedAt: new Date(),
    })
    .where(and(eq(diligenceDocuments.id, id), eq(diligenceDocuments.workspaceId, ws.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Move the partner to vetted so they show up in Discover.
  await db
    .update(nonprofitPartners)
    .set({ status: "vetted", updatedAt: new Date() })
    .where(eq(nonprofitPartners.id, updated.partnerId));

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary.id,
    actorKind: "user",
    action: "diligence.approved",
    targetType: "diligence_document",
    targetId: updated.id,
    payload: { partner_id: updated.partnerId },
  });

  return NextResponse.json({ ok: true });
}
