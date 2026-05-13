import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { nonprofitRecaps } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import {
  NonprofitRecapDocument,
  type NonprofitRecapInitial,
} from "@/components/np/NonprofitRecapDocument";

type Props = { params: Promise<{ id: string }> };

export default async function NonprofitRecapPage({ params }: Props) {
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

  const initial: NonprofitRecapInitial = {
    id: recap.id,
    period: recap.period,
    nonprofitName: ws.name,
    approverName: ws.primaryUser.name,
    approverRole: ws.primaryUser.role,
  };

  // Already drafted — server-render the saved version, no stream.
  if (recap.status !== "drafting" || recap.openingPara) {
    initial.saved = {
      status: recap.status as "awaiting_approval" | "approved",
      opening_para: recap.openingPara ?? "",
      partner_contributions:
        (recap.partnerContributions as {
          partner_workspace_id: string;
          partner_name: string;
          paragraph: string;
          named_volunteers: string[];
        }[]) ?? [],
      what_worked: recap.whatWorked ?? "",
      what_drifted: recap.whatDrifted ?? "",
      ask_for_next_quarter: recap.askForNextQuarter ?? "",
      approved_at: recap.approvedAt?.toISOString() ?? null,
    };
  }

  return <NonprofitRecapDocument {...initial} />;
}
