import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, marketingArtifacts, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { content_md: string };

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;

  const [existing] = await db
    .select()
    .from(marketingArtifacts)
    .where(eq(marketingArtifacts.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const original = existing.contentMdOriginal ?? existing.contentMd;
  await db
    .update(marketingArtifacts)
    .set({ contentMd: body.content_md, contentMdOriginal: original })
    .where(eq(marketingArtifacts.id, id));

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);
  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "artifact.edited",
    targetType: "marketing_artifact",
    targetId: id,
    payload: { chars: body.content_md.length, kind: existing.kind },
  });

  return NextResponse.json({ ok: true });
}
