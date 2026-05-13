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

export async function POST(_req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json(
      { error: "Nonprofit workspace required" },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;

  // Scope check: artifact must belong to a recap owned by the active np
  // workspace. We join through the recap.
  const [row] = await db
    .select({ artifact: nonprofitArtifacts, recap: nonprofitRecaps })
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

  const [updated] = await db
    .update(nonprofitArtifacts)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(nonprofitArtifacts.id, id))
    .returning();

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);
  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "np_artifact.approved",
    targetType: "nonprofit_artifact",
    targetId: updated.id,
    payload: { kind: updated.kind, recap_id: updated.recapId },
  });
  return NextResponse.json({ ok: true });
}
