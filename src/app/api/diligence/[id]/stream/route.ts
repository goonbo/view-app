import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { diligenceDocuments } from "@/db/schema";
import { propublica } from "@/lib/propublica";
import { charityNavigator } from "@/lib/charity-navigator";
import { llm } from "@/lib/llm/adapter";
import {
  DILIGENCE_SYSTEM,
  DILIGENCE_STRUCTURED_INSTRUCTION,
  DiligenceStructuredSchema,
  buildDiligenceUserPrompt,
  fixtureKeyForNarrative,
  fixtureKeyForStructured,
} from "@/lib/llm/diligence";
import { getActiveWorkspace } from "@/lib/active-workspace";

/**
 * Streaming diligence orchestration. Emits Server-Sent Events for each of
 * the five sections so the document fills in section-by-section in the UI.
 *
 * Event types:
 *   stage             — stage label + status ("running" | "done" | "skipped")
 *   verified-facts    — section 1: IRS / org metadata
 *   filing-summary    — section 2: latest 990 financials
 *   charity-nav       — section 3: rating + beacons (or skipped)
 *   ai-token          — section 4: streamed token of the narrative
 *   structured-result — section 5: concern level + things to verify
 *   complete          — orchestration done
 *   error             — fatal error; client should stop reading
 *
 * Each event's payload is JSON-encoded as the `data:` field.
 *
 * Runtime: we want edge, but the fixture adapter reads from disk via fs.
 * Node runtime is fine — Neon HTTP works there too — and lets fixture mode
 * work without bundling JSON files.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;

  // Look up the diligence document to recover its EIN.
  const docs = await db
    .select({ ein: diligenceDocuments.ein, workspaceId: diligenceDocuments.workspaceId })
    .from(diligenceDocuments)
    .where(eq(diligenceDocuments.id, id))
    .limit(1);
  const doc = docs[0];
  if (!doc) {
    return NextResponse.json({ error: "Diligence document not found" }, { status: 404 });
  }
  const ein = doc.ein.replace(/-/g, "");

  const workspace = await getActiveWorkspace();
  const corporateWorkspaceName = workspace?.name ?? "Acme Robotics";
  const primaryCauseArea =
    workspace?.causeAreas?.[0] ?? "education";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        // ── Section 1: IRS verification ──────────────────────
        send("stage", { section: 1, label: "Confirming IRS tax-exempt status", status: "running" });
        const org = await propublica.getOrganization(ein);
        send("stage", { section: 1, label: "IRS tax-exempt status confirmed", status: "done" });
        send("verified-facts", {
          section: 1,
          ein: org.ein,
          legal_name: org.legal_name,
          common_name: org.common_name,
          address: org.address,
          city: org.city,
          state: org.state,
          ntee_classification: org.ntee_classification,
          ruling_date: org.ruling_date,
          total_assets: org.total_assets,
          mission: org.mission,
          website: org.website,
        });

        // ── Section 2: Form 990 summary ──────────────────────
        const latest = org.filings[0];
        const prev = org.filings[1];
        if (latest) {
          send("stage", {
            section: 2,
            label: `Reading latest Form 990 (FY${latest.tax_period})`,
            status: "running",
          });
          const yoy = prev
            ? ((latest.total_revenue - prev.total_revenue) / prev.total_revenue) * 100
            : null;
          const programRatio =
            latest.total_expenses > 0
              ? latest.program_service_revenue / latest.total_revenue
              : null;
          send("filing-summary", {
            section: 2,
            tax_period: latest.tax_period,
            total_revenue: latest.total_revenue,
            total_expenses: latest.total_expenses,
            program_service_revenue: latest.program_service_revenue,
            executive_comp: latest.executive_comp,
            total_assets: latest.total_assets,
            yoy_revenue_pct: yoy,
            program_revenue_share: programRatio,
            flags: {
              yoy_decline: yoy !== null && yoy < -15,
              low_program_share: programRatio !== null && programRatio < 0.1,
            },
          });
          send("stage", { section: 2, label: "990 summary read", status: "done" });
        }

        // ── Section 3: Charity Navigator (optional) ──────────
        if (charityNavigator.isConfigured()) {
          send("stage", {
            section: 3,
            label: "Cross-checking Charity Navigator",
            status: "running",
          });
          const rating = await charityNavigator.getRating(ein);
          if (rating) {
            send("charity-nav", { section: 3, rating });
            send("stage", { section: 3, label: "Charity Navigator cross-check complete", status: "done" });
          } else {
            send("stage", {
              section: 3,
              label: "Charity Navigator has no rating for this EIN",
              status: "skipped",
            });
          }
        } else {
          send("stage", {
            section: 3,
            label: "Charity Navigator not configured",
            status: "skipped",
          });
        }

        // ── Section 4: Narrative stream ──────────────────────
        send("stage", {
          section: 4,
          label: `Synthesizing partnership read for ${corporateWorkspaceName}'s ${primaryCauseArea} focus`,
          status: "running",
        });
        const userPrompt = buildDiligenceUserPrompt({
          org,
          filings: org.filings,
          charityNavigator: null,
          corporateWorkspaceName,
          primaryCauseArea,
        });
        for await (const token of llm.streamText({
          fixtureKey: fixtureKeyForNarrative(ein),
          systemPrompt: DILIGENCE_SYSTEM,
          userPrompt,
        })) {
          send("ai-token", { section: 4, delta: token });
        }
        send("stage", { section: 4, label: "Synthesis complete", status: "done" });

        // ── Section 5: Structured tail ───────────────────────
        send("stage", {
          section: 5,
          label: "Three things to verify before you commit",
          status: "running",
        });
        const structured = await llm.generateObject({
          fixtureKey: fixtureKeyForStructured(ein),
          systemPrompt: `${DILIGENCE_SYSTEM}\n\n${DILIGENCE_STRUCTURED_INSTRUCTION}`,
          userPrompt,
          schema: DiligenceStructuredSchema,
        });
        send("structured-result", { section: 5, ...structured });
        send("stage", { section: 5, label: "Things-to-verify drafted", status: "done" });

        send("complete", { ein, diligenceId: id, generatedBy: "claude-sonnet-4-6" });
        controller.close();
      } catch (err) {
        const message = (err as Error).message || "Unknown error";
        send("error", { message });
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
