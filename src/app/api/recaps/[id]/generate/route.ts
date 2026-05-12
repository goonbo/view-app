import { NextResponse } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  donations,
  eventSignups,
  events,
  nonprofitPartners,
  recaps,
} from "@/db/schema";
import { llm } from "@/lib/llm/adapter";
import {
  RECAP_STRUCTURED_INSTRUCTION,
  RECAP_SYSTEM,
  RecapStructuredSchema,
  buildRecapUserPrompt,
  fixtureKeyForRecap,
  fixtureKeyForRecapStructured,
} from "@/lib/llm/recap";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Streaming recap generator. Emits SSE events as the document builds:
 *   stage             — stage label + status
 *   ai-token          — streamed narrative tokens
 *   structured-result — by_the_numbers + outcomes + recommendations
 *   complete          — orchestration done
 *   error             — fatal
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const [recap] = await db
    .select()
    .from(recaps)
    .where(and(eq(recaps.id, id), eq(recaps.workspaceId, ws.id)))
    .limit(1);
  if (!recap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Pull period activity to ground the prompt. This matters most in live
  // mode; in fixture mode the same key replays canned text.
  const signupRows = await db
    .select({
      event_title: events.title,
      capacity: events.capacity,
      confirmed: events.confirmedCapacity,
      checked_in: sql<string>`SUM(CASE WHEN ${eventSignups.status} = 'checked_in' THEN 1 ELSE 0 END)`,
      hours: sql<string>`COALESCE(SUM(${eventSignups.hoursLogged}), 0)`,
    })
    .from(events)
    .leftJoin(eventSignups, eq(eventSignups.eventId, events.id))
    .where(
      and(
        eq(events.corporateWorkspaceId, ws.id),
        gte(events.startsAt, recap.periodStart),
        lte(events.endsAt, recap.periodEnd),
      ),
    )
    .groupBy(events.id, events.title, events.capacity, events.confirmedCapacity);

  const [donationTotals] = await db
    .select({
      count: sql<string>`COUNT(*)`,
      raised: sql<string>`COALESCE(SUM(${donations.amount}), 0)`,
      matched: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)`,
    })
    .from(donations)
    .where(
      and(
        eq(donations.corporateWorkspaceId, ws.id),
        gte(donations.createdAt, recap.periodStart),
        lte(donations.createdAt, recap.periodEnd),
      ),
    );

  const partners = await db
    .select({ commonName: nonprofitPartners.commonName })
    .from(nonprofitPartners)
    .where(
      and(
        eq(nonprofitPartners.corporateWorkspaceId, ws.id),
        eq(nonprofitPartners.status, "vetted"),
      ),
    );

  const userPrompt = buildRecapUserPrompt({
    corporateWorkspaceName: ws.name,
    scope: recap.scope as "event" | "quarterly",
    scopeTargetName: recap.title,
    periodStart: recap.periodStart.toISOString().slice(0, 10),
    periodEnd: recap.periodEnd.toISOString().slice(0, 10),
    signupRows: signupRows.map((r) => ({
      event: r.event_title,
      checked_in: Number(r.checked_in ?? 0),
      capacity: r.confirmed ?? r.capacity,
      hours: Number(r.hours ?? 0),
    })),
    donationTotals: {
      count: Number(donationTotals?.count ?? 0),
      raised: Number(donationTotals?.raised ?? 0),
      matched: Number(donationTotals?.matched ?? 0),
    },
    partnerNames: partners.map((p) => p.commonName),
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send("stage", { label: "Reviewing the period's activity", status: "running" });
        send("stage", { label: "Reviewed", status: "done" });

        send("stage", { label: "Synthesizing recap narrative", status: "running" });
        let narrative = "";
        for await (const tok of llm.streamText({
          fixtureKey: fixtureKeyForRecap(id),
          fixtureFallbackKey: "recap-default",
          systemPrompt: RECAP_SYSTEM,
          userPrompt,
        })) {
          narrative += tok;
          send("ai-token", { delta: tok });
        }
        send("stage", { label: "Narrative complete", status: "done" });

        send("stage", { label: "Drafting outcomes + recommendations", status: "running" });
        const structured = await llm.generateObject({
          fixtureKey: fixtureKeyForRecapStructured(id),
          fixtureFallbackKey: "recap-structured-default",
          systemPrompt: `${RECAP_SYSTEM}\n\n${RECAP_STRUCTURED_INSTRUCTION}`,
          userPrompt,
          schema: RecapStructuredSchema,
        });
        send("structured-result", structured);
        send("stage", { label: "Outcomes drafted", status: "done" });

        send("complete", { id, narrativeChars: narrative.length });
        controller.close();
      } catch (err) {
        send("error", { message: (err as Error).message });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
