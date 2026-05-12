import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { eventSignups, events } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Read-only live snapshot of the cross-tenant fields for an event. Polled
 * every 2s by both the corporate and nonprofit detail pages.
 *
 * The payload is intentionally narrow — only the fields that change as
 * the two sides collaborate (shared_notes, supplies, capacity, status,
 * signups count). Static fields stay on the SSR-rendered page.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "No workspace" }, { status: 403 });
  const { id } = await ctx.params;

  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Coarse access check: nonprofit owner OR any corporate workspace with
  // a partner relationship to the nonprofit. We trust the detail page to
  // gate access more strictly; this endpoint just provides the diff.
  if (
    ws.type === "nonprofit" &&
    ev.nonprofitWorkspaceId !== ws.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const signupRows = await db
    .select({ status: eventSignups.status })
    .from(eventSignups)
    .where(eq(eventSignups.eventId, ev.id));
  const registered = signupRows.filter(
    (s) => s.status === "registered" || s.status === "checked_in",
  ).length;

  return NextResponse.json({
    id: ev.id,
    status: ev.status,
    shared_notes: ev.sharedNotes ?? "",
    supplies: ev.supplies ?? [],
    capacity: ev.capacity,
    confirmed_capacity: ev.confirmedCapacity,
    registered_count: registered,
    updated_at: ev.updatedAt.toISOString(),
  });
}
