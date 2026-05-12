import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { marketingArtifacts, recaps } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import {
  MarketingArtifacts,
  type ArtifactRow,
  type ArtifactKind,
} from "@/components/recaps/MarketingArtifacts";

type Props = { params: Promise<{ id: string }> };

export default async function MarketingPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const [recap] = await db
    .select()
    .from(recaps)
    .where(and(eq(recaps.id, id), eq(recaps.workspaceId, ws.id)))
    .limit(1);
  if (!recap) notFound();

  const artifacts = await db
    .select()
    .from(marketingArtifacts)
    .where(eq(marketingArtifacts.recapId, id));

  const rows: ArtifactRow[] = artifacts.map((a) => ({
    id: a.id,
    recap_id: a.recapId,
    kind: a.kind as ArtifactKind,
    content_md: a.contentMd,
    content_md_original: a.contentMdOriginal,
    status: a.status as ArtifactRow["status"],
    approved_at: a.approvedAt?.toISOString() ?? null,
  }));

  return (
    <MarketingArtifacts
      recapId={recap.id}
      recapTitle={recap.title}
      initial={rows}
      approverName={ws.primaryUser.name}
    />
  );
}
