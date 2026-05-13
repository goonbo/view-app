import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { events, nonprofitRecaps } from "@/db/schema";
import { llm } from "@/lib/llm/adapter";
import {
  NONPROFIT_RECAP_STRUCTURED_INSTRUCTION,
  NONPROFIT_RECAP_SYSTEM,
  NonprofitRecapStructuredSchema,
  buildNonprofitRecapUserPrompt,
  fixtureKeyForNonprofitRecap,
  fixtureKeyForNonprofitRecapStructured,
} from "@/lib/llm/nonprofit-recap";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { listVolunteerProfiles } from "@/lib/volunteer-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json(
      { error: "Nonprofit workspace required" },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  const [recap] = await db
    .select()
    .from(nonprofitRecaps)
    .where(
      and(
        eq(nonprofitRecaps.id, id),
        eq(nonprofitRecaps.nonprofitWorkspaceId, ws.id),
      ),
    )
    .limit(1);
  if (!recap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build the user prompt from real activity. Per-partner aggregates,
  // notable named volunteers, total hours.
  const profiles = await listVolunteerProfiles(ws.id);
  const totalHours = profiles.reduce((s, p) => s + p.totalHours, 0);
  const totalVolunteers = profiles.length;

  const [eventCountRow] = await db
    .select({ c: sql<string>`COUNT(*)` })
    .from(events)
    .where(eq(events.nonprofitWorkspaceId, ws.id));

  // Group profiles by employer + pick 3-5 named.
  const byEmployer = new Map<string, typeof profiles>();
  for (const p of profiles) {
    const arr = byEmployer.get(p.employerWorkspaceId) ?? [];
    arr.push(p);
    byEmployer.set(p.employerWorkspaceId, arr);
  }
  const partners = Array.from(byEmployer.entries()).map(([id, arr]) => {
    const top = arr
      .slice()
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 4)
      .map((p) => ({
        name: p.fullName,
        hours: p.totalHours,
        tags: p.tags,
      }));
    return {
      workspaceId: id,
      name: arr[0]?.employerName ?? "Partner",
      volunteerCount: arr.length,
      hours: arr.reduce((s, p) => s + p.totalHours, 0),
      namedVolunteers: top,
    };
  });

  const outcomeEquivalent = `${(totalHours / 800).toFixed(1)} family home builds`;
  const userPrompt = buildNonprofitRecapUserPrompt({
    nonprofitName: ws.name,
    period: recap.period,
    partners,
    totalHours,
    totalVolunteers,
    eventCount: Number(eventCountRow?.c ?? 0),
    outcomeEquivalent,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      try {
        send("stage", { label: "Reviewing the quarter's activity", status: "done" });
        send("stage", { label: "Drafting recap narrative", status: "running" });
        let narrative = "";
        for await (const tok of llm.streamText({
          fixtureKey: fixtureKeyForNonprofitRecap(id),
          fixtureFallbackKey: "np-recap-narrative-default",
          systemPrompt: NONPROFIT_RECAP_SYSTEM,
          userPrompt,
        })) {
          narrative += tok;
          send("ai-token", { delta: tok });
        }
        send("stage", { label: "Narrative complete", status: "done" });
        send("stage", { label: "Drafting partner contributions + ask", status: "running" });
        const structured = await llm.generateObject({
          fixtureKey: fixtureKeyForNonprofitRecapStructured(id),
          fixtureFallbackKey: "np-recap-structured-default",
          systemPrompt: `${NONPROFIT_RECAP_SYSTEM}\n\n${NONPROFIT_RECAP_STRUCTURED_INSTRUCTION}`,
          userPrompt,
          schema: NonprofitRecapStructuredSchema,
        });
        send("structured-result", structured);
        send("stage", { label: "Structured tail drafted", status: "done" });
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
