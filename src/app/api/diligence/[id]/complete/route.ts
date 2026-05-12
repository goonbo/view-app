import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, diligenceDocuments } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = {
  narrative: string;
  things_to_verify: string[];
  concern_level: "low" | "medium" | "high";
  signals: Record<string, unknown>;
};

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const [updated] = await db
    .update(diligenceDocuments)
    .set({
      narrative: body.narrative,
      thingsToVerify: body.things_to_verify,
      concernLevel: body.concern_level,
      signals: body.signals,
      status: "ready_for_review",
      generatedAt: new Date(),
    })
    .where(and(eq(diligenceDocuments.id, id), eq(diligenceDocuments.workspaceId, ws.id)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorKind: "claude",
    action: "diligence.generated",
    targetType: "diligence_document",
    targetId: updated.id,
    payload: { concern_level: body.concern_level },
  });

  return NextResponse.json({ ok: true });
}
