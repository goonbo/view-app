import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, recaps } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = {
  narrative_md: string;
  by_the_numbers: Record<string, string | number>;
  outcomes: { headline: string; body: string }[];
  recommendations: { headline: string; body: string }[];
};

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const [updated] = await db
    .update(recaps)
    .set({
      narrativeMd: body.narrative_md,
      byTheNumbers: body.by_the_numbers,
      outcomes: body.outcomes,
      recommendations: body.recommendations,
      lede:
        body.narrative_md.split(/\n\s*\n/)[0]?.replace(/^#+\s*/, "").slice(0, 280) ?? null,
      status: "draft",
      generatedAt: new Date(),
    })
    .where(and(eq(recaps.id, id), eq(recaps.workspaceId, ws.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorKind: "claude",
    action: "recap.generated",
    targetType: "recap",
    targetId: updated.id,
    payload: { narrative_chars: body.narrative_md.length },
  });

  return NextResponse.json({ ok: true });
}
