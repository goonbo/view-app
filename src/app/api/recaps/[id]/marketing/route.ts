import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { marketingArtifacts, recaps } from "@/db/schema";
import { llm } from "@/lib/llm/adapter";
import {
  ARTIFACT_KICKERS,
  ArtifactSchema,
  MARKETING_BASE_SYSTEM,
  buildArtifactUserPrompt,
  fixtureFallbackKeyForArtifact,
  fixtureKeyForArtifact,
  type ArtifactKind,
} from "@/lib/llm/marketing-artifacts";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type RouteCtx = { params: Promise<{ id: string }> };

const ALL_KINDS: ArtifactKind[] = [
  "linkedin",
  "newsletter",
  "all_hands",
  "social_short",
  "csr_page",
];

/**
 * Generates ALL 5 marketing artifacts for a recap in parallel.
 * Idempotent — re-running deletes any existing `draft`-state rows and
 * regenerates. Approved/rejected rows are preserved.
 */
export async function POST(_req: Request, ctx: RouteCtx) {
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
  if (!recap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Wipe existing draft-state artifacts so a re-run replaces them.
  await db
    .delete(marketingArtifacts)
    .where(
      and(
        eq(marketingArtifacts.recapId, recap.id),
        eq(marketingArtifacts.status, "draft"),
      ),
    );

  // Determine which kinds still need generation (skip already-approved).
  const existing = await db
    .select()
    .from(marketingArtifacts)
    .where(
      and(
        eq(marketingArtifacts.recapId, recap.id),
        inArray(marketingArtifacts.status, ["approved", "rejected"]),
      ),
    );
  const existingKinds = new Set(existing.map((a) => a.kind as ArtifactKind));
  const kindsToGenerate = ALL_KINDS.filter((k) => !existingKinds.has(k));

  const drafts = await Promise.all(
    kindsToGenerate.map(async (kind) => {
      const result = await llm.generateObject({
        fixtureKey: fixtureKeyForArtifact(recap.id, kind),
        fixtureFallbackKey: fixtureFallbackKeyForArtifact(kind),
        systemPrompt: `${MARKETING_BASE_SYSTEM}\n\n${ARTIFACT_KICKERS[kind]}`,
        userPrompt: buildArtifactUserPrompt({
          kind,
          recapTitle: recap.title,
          recapLede: recap.lede,
          recapBody: recap.narrativeMd,
          byTheNumbers: (recap.byTheNumbers as Record<string, string | number>) ?? undefined,
        }),
        schema: ArtifactSchema,
      });
      const [row] = await db
        .insert(marketingArtifacts)
        .values({
          recapId: recap.id,
          kind,
          contentMd: result.content_md,
          contentMdOriginal: result.content_md,
          status: "draft",
        })
        .returning();
      return row;
    }),
  );

  // Return drafts + existing approved/rejected so the client can render
  // the full set without a second fetch. Snake-case the keys so the
  // shape matches what the server-rendered page produces.
  const combined = [...existing, ...drafts].map((a) => ({
    id: a.id,
    recap_id: a.recapId,
    kind: a.kind,
    content_md: a.contentMd,
    content_md_original: a.contentMdOriginal,
    status: a.status,
    approved_at: a.approvedAt?.toISOString() ?? null,
  }));
  return NextResponse.json({ artifacts: combined });
}
