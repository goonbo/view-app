import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { commsDrafts, events, nonprofitPartners } from "@/db/schema";
import { llm } from "@/lib/llm/adapter";
import {
  COMMS_DRAFT_SYSTEM,
  buildCommsUserPrompt,
  commsFixtureKey,
  commsSchema,
  eventSlug,
  type CommsKind,
} from "@/lib/llm/comms-draft";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = {
  channels: CommsKind[];
  audience: string[];
};

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Drafts comms for an event activation in parallel — one Claude call per
 * selected channel. Each draft persists as a `comms_drafts` row in `draft`
 * state; the corporate side then approves each panel individually.
 *
 * Re-running this endpoint replaces existing draft-state rows for the
 * same event+kind (so the user can re-roll a single channel by re-running).
 */
export async function POST(req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;
  const channels = body.channels?.length ? body.channels : (["email", "slack", "calendar"] as CommsKind[]);
  const audience = body.audience?.length ? body.audience : ["All staff"];

  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // CROSS_WORKSPACE_READ: corporate reads nonprofit-owned event to draft
  // comms for activation; justified by the partner relationship.
  const [partner] = ev.partnerId
    ? await db
        .select({ commonName: nonprofitPartners.commonName })
        .from(nonprofitPartners)
        .where(eq(nonprofitPartners.id, ev.partnerId))
        .limit(1)
    : await db
        .select({ commonName: nonprofitPartners.commonName })
        .from(nonprofitPartners)
        .where(
          and(
            eq(nonprofitPartners.corporateWorkspaceId, ws.id),
            eq(nonprofitPartners.nonprofitWorkspaceId, ev.nonprofitWorkspaceId),
          ),
        )
        .limit(1);
  const nonprofitName = partner?.commonName ?? "the partner nonprofit";

  // Wipe existing draft-state rows for these channels so we don't duplicate.
  await db
    .delete(commsDrafts)
    .where(
      and(
        eq(commsDrafts.eventId, ev.id),
        inArray(commsDrafts.kind, channels),
        eq(commsDrafts.status, "draft"),
      ),
    );

  const slug = eventSlug(ev.title);
  const eventDate = ev.startsAt.toISOString().slice(0, 10);

  const drafted = await Promise.all(
    channels.map(async (kind) => {
      const schema = commsSchema(kind);
      const draft = await llm.generateObject({
        fixtureKey: commsFixtureKey(slug, kind),
        fixtureFallbackKey: commsFixtureKey("default", kind),
        systemPrompt: COMMS_DRAFT_SYSTEM,
        userPrompt: buildCommsUserPrompt({
          kind,
          eventTitle: ev.title,
          nonprofitName,
          eventDate,
          location: ev.location,
          capacity: ev.capacity,
          description: ev.description,
          audience,
        }),
        schema,
      });
      const subject =
        kind === "email" ? (draft as unknown as { subject: string }).subject : null;
      const bodyText = (draft as unknown as { body: string }).body;
      const [row] = await db
        .insert(commsDrafts)
        .values({
          eventId: ev.id,
          kind,
          subject,
          body: bodyText,
          bodyOriginal: bodyText,
          status: "draft",
        })
        .returning();
      return row;
    }),
  );

  return NextResponse.json({ drafts: drafted });
}
