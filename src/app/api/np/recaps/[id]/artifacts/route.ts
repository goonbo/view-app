import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { nonprofitArtifacts, nonprofitRecaps } from "@/db/schema";
import { llm } from "@/lib/llm/adapter";
import {
  NONPROFIT_ARTIFACT_KICKERS,
  NONPROFIT_ARTIFACT_SYSTEM,
  NonprofitArtifactSchema,
  buildNonprofitArtifactUserPrompt,
  fixtureFallbackKeyForNonprofitArtifact,
  fixtureKeyForNonprofitArtifact,
  type NonprofitArtifactKind,
} from "@/lib/llm/nonprofit-artifacts";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

const ALL_KINDS: NonprofitArtifactKind[] = [
  "donor_newsletter",
  "grant_snippet",
  "board_update",
  "social_thanks",
];

/**
 * Generates all 4 nonprofit-side marketing artifacts in parallel.
 * Idempotent — wipes existing draft-state rows and regenerates; approved
 * + rejected rows are preserved.
 */
export async function POST(_req: Request, ctx: RouteCtx) {
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
  if (!recap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .delete(nonprofitArtifacts)
    .where(
      and(
        eq(nonprofitArtifacts.recapId, recap.id),
        eq(nonprofitArtifacts.status, "drafting"),
      ),
    );

  const existing = await db
    .select()
    .from(nonprofitArtifacts)
    .where(
      and(
        eq(nonprofitArtifacts.recapId, recap.id),
        inArray(nonprofitArtifacts.status, ["approved", "rejected"]),
      ),
    );
  const existingKinds = new Set(
    existing.map((a) => a.kind as NonprofitArtifactKind),
  );
  const kindsToGenerate = ALL_KINDS.filter((k) => !existingKinds.has(k));

  const drafted = await Promise.all(
    kindsToGenerate.map(async (kind) => {
      const result = await llm.generateObject({
        fixtureKey: fixtureKeyForNonprofitArtifact(recap.id, kind),
        fixtureFallbackKey: fixtureFallbackKeyForNonprofitArtifact(kind),
        systemPrompt: `${NONPROFIT_ARTIFACT_SYSTEM}\n\n${NONPROFIT_ARTIFACT_KICKERS[kind]}`,
        userPrompt: buildNonprofitArtifactUserPrompt({
          kind,
          recapPeriod: recap.period,
          openingPara: recap.openingPara,
          whatWorked: recap.whatWorked,
          whatDrifted: recap.whatDrifted,
          askForNextQuarter: recap.askForNextQuarter,
          partnerContributions:
            (recap.partnerContributions as {
              partner_name: string;
              paragraph: string;
              named_volunteers: string[];
            }[]) ?? [],
        }),
        schema: NonprofitArtifactSchema,
      });
      const [row] = await db
        .insert(nonprofitArtifacts)
        .values({
          recapId: recap.id,
          kind,
          body: result.body,
          bodyOriginal: result.body,
          status: "drafting",
        })
        .returning();
      return row;
    }),
  );

  const combined = [...existing, ...drafted].map((a) => ({
    id: a.id,
    recap_id: a.recapId,
    kind: a.kind,
    body: a.body,
    body_original: a.bodyOriginal,
    status: a.status,
    approved_at: a.approvedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({ artifacts: combined });
}
