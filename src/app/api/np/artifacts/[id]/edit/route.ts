import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  nonprofitArtifacts,
  nonprofitRecaps,
  users,
} from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

type Body = { body: string };

export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json(
      { error: "Nonprofit workspace required" },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  const payload = (await req.json()) as Body;
  if (!payload?.body || typeof payload.body !== "string") {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  const [row] = await db
    .select({ artifact: nonprofitArtifacts })
    .from(nonprofitArtifacts)
    .innerJoin(
      nonprofitRecaps,
      eq(nonprofitArtifacts.recapId, nonprofitRecaps.id),
    )
    .where(
      and(
        eq(nonprofitArtifacts.id, id),
        eq(nonprofitRecaps.nonprofitWorkspaceId, ws.id),
      ),
    )
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Preserve the very first AI draft in body_original — only set it once.
  const original = row.artifact.bodyOriginal ?? row.artifact.body;
  await db
    .update(nonprofitArtifacts)
    .set({ body: payload.body, bodyOriginal: original })
    .where(eq(nonprofitArtifacts.id, id));

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);
  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "np_artifact.edited",
    targetType: "nonprofit_artifact",
    targetId: id,
    payload: { chars: payload.body.length, kind: row.artifact.kind },
  });

  return NextResponse.json({ ok: true });
}
