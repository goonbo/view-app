import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, events, recaps, users } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = {
  scope: "event" | "quarterly";
  /** Event id when scope=event; otherwise omitted. */
  event_id?: string;
};

/**
 * Creates a recap in `draft` state. The client then opens the page and the
 * SSE stream fills it in. Returns the created id immediately so the client
 * can navigate.
 */
export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }
  const body = (await req.json()) as Body;

  let title = "Quarterly Community Recap";
  let scopeTargetId: string | null = null;
  let periodStart = quarterStart();
  let periodEnd = new Date();

  if (body.scope === "event" && body.event_id) {
    const [ev] = await db
      .select()
      .from(events)
      .where(eq(events.id, body.event_id))
      .limit(1);
    if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (ev.corporateWorkspaceId !== ws.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    title = `${ev.title} — Recap`;
    scopeTargetId = ev.id;
    periodStart = ev.startsAt;
    periodEnd = ev.endsAt;
  }

  const [recap] = await db
    .insert(recaps)
    .values({
      workspaceId: ws.id,
      scope: body.scope,
      scopeTargetId,
      periodStart,
      periodEnd,
      title,
      status: "draft",
      byTheNumbers: {},
      outcomes: [],
      recommendations: [],
    })
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
    action: "recap.created",
    targetType: "recap",
    targetId: recap.id,
    payload: { scope: body.scope, title },
  });

  return NextResponse.json({ recap });
}

function quarterStart(): Date {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
