import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { recaps } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { RecapDocument, type RecapInitial } from "@/components/recaps/RecapDocument";

type Props = { params: Promise<{ id: string }> };

export default async function RecapPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const [recap] = await db
    .select()
    .from(recaps)
    .where(and(eq(recaps.id, id), eq(recaps.workspaceId, ws.id)))
    .limit(1);
  if (!recap) notFound();

  const initial: RecapInitial = {
    id: recap.id,
    title: recap.title,
    scope: recap.scope,
    periodStart: recap.periodStart.toISOString(),
    periodEnd: recap.periodEnd.toISOString(),
    approverName: ws.primaryUser.name,
    partnerLine: `Prepared for the ${ws.name} leadership team`,
  };

  if (recap.status !== "draft" || recap.narrativeMd) {
    initial.saved = {
      status: recap.status as "draft" | "approved",
      lede: recap.lede,
      narrative_md: recap.narrativeMd ?? "",
      narrative_md_original: recap.narrativeMdOriginal,
      by_the_numbers: (recap.byTheNumbers as Record<string, string | number>) ?? {},
      outcomes:
        (recap.outcomes as { headline: string; body: string }[]) ?? [],
      recommendations:
        (recap.recommendations as { headline: string; body: string }[]) ?? [],
      approved_at: recap.approvedAt ? recap.approvedAt.toISOString() : null,
    };
  }

  return <RecapDocument {...initial} />;
}
