import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  commsDrafts,
  events,
  nonprofitPartners,
  users,
} from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = {
  audience: string[];
  estimated_audience_size?: number;
};

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Final activation send. All approved comms_drafts for the event get
 * marked sent. The event moves to `activated`. confirmed_capacity is set
 * to min(capacity, 80% of estimated_audience_size) per the spec.
 *
 * The partner relationship between the corporate workspace and the
 * nonprofit workspace is recorded on the event so cross-workspace reads
 * downstream are straightforward.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Resolve which partner row corresponds to the event's nonprofit workspace
  // inside this corporate workspace.
  const [partner] = await db
    .select()
    .from(nonprofitPartners)
    .where(
      and(
        eq(nonprofitPartners.corporateWorkspaceId, ws.id),
        eq(nonprofitPartners.nonprofitWorkspaceId, ev.nonprofitWorkspaceId),
      ),
    )
    .limit(1);
  if (!partner) {
    return NextResponse.json(
      { error: "No partner relationship — vet this nonprofit first." },
      { status: 400 },
    );
  }

  // Require all comms drafts for this event to be approved before sending.
  const drafts = await db
    .select()
    .from(commsDrafts)
    .where(eq(commsDrafts.eventId, ev.id));
  const unapproved = drafts.filter((d) => d.status !== "approved");
  if (drafts.length === 0 || unapproved.length > 0) {
    return NextResponse.json(
      { error: "Approve all comms drafts before sending." },
      { status: 400 },
    );
  }

  const audienceSize = body.estimated_audience_size ?? 100;
  const confirmedCapacity = Math.min(
    ev.capacity,
    Math.floor(audienceSize * 0.8),
  );

  const [primary] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.workspaceId, ws.id))
    .limit(1);

  const sentAt = new Date();

  await db
    .update(commsDrafts)
    .set({ status: "sent", sentAt })
    .where(
      and(
        eq(commsDrafts.eventId, ev.id),
        inArray(
          commsDrafts.kind,
          drafts.map((d) => d.kind),
        ),
      ),
    );

  const [updated] = await db
    .update(events)
    .set({
      status: "activated",
      activatedAt: sentAt,
      corporateWorkspaceId: ws.id,
      partnerId: partner.id,
      confirmedCapacity,
      updatedAt: sentAt,
    })
    .where(eq(events.id, ev.id))
    .returning();

  for (const d of drafts) {
    await db.insert(auditLog).values({
      workspaceId: ws.id,
      actorId: primary?.id,
      actorKind: "user",
      action: "comms.sent",
      targetType: "comms_draft",
      targetId: d.id,
      payload: { event_id: ev.id, kind: d.kind, audience: body.audience ?? [] },
    });
  }
  await db.insert(auditLog).values({
    workspaceId: ws.id,
    actorId: primary?.id,
    actorKind: "user",
    action: "event.activated",
    targetType: "event",
    targetId: updated.id,
    payload: { confirmed_capacity: confirmedCapacity, audience: body.audience ?? [] },
  });

  return NextResponse.json({ event: updated, sentDrafts: drafts.length });
}
