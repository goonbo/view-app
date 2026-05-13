import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { nonprofitArtifacts, nonprofitRecaps } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import {
  NonprofitArtifacts,
  type ArtifactRow,
} from "@/components/np/NonprofitArtifacts";
import type { NonprofitArtifactKind } from "@/lib/llm/nonprofit-artifacts";

type Props = { params: Promise<{ id: string }> };

export default async function NonprofitArtifactsPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/workbench");

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
  if (!recap) notFound();

  const artifacts = await db
    .select()
    .from(nonprofitArtifacts)
    .where(eq(nonprofitArtifacts.recapId, id));

  const rows: ArtifactRow[] = artifacts.map((a) => ({
    id: a.id,
    recap_id: a.recapId,
    kind: a.kind as NonprofitArtifactKind,
    body: a.body,
    body_original: a.bodyOriginal,
    status: a.status as ArtifactRow["status"],
    approved_at: a.approvedAt?.toISOString() ?? null,
  }));

  return (
    <NonprofitArtifacts
      recapId={recap.id}
      recapPeriod={recap.period}
      initial={rows}
      approverName={ws.primaryUser.name}
    />
  );
}
