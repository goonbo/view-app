import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { nonprofitArtifacts, nonprofitRecaps } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";
import { NonprofitRecapCreateActions } from "@/components/np/NonprofitRecapCreateActions";

const STATUS_TONE: Record<string, StatusPillTone> = {
  drafting: "neutral",
  awaiting_approval: "neutral",
  approved: "success",
};

const STATUS_LABEL: Record<string, string> = {
  drafting: "Drafting",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
};

export default async function NonprofitRecapsPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/workbench");

  const list = await db
    .select()
    .from(nonprofitRecaps)
    .where(eq(nonprofitRecaps.nonprofitWorkspaceId, ws.id))
    .orderBy(desc(nonprofitRecaps.createdAt));

  const artifactCounts =
    list.length === 0
      ? []
      : await db
          .select({
            recap_id: nonprofitArtifacts.recapId,
            status: nonprofitArtifacts.status,
          })
          .from(nonprofitArtifacts)
          .where(
            inArray(
              nonprofitArtifacts.recapId,
              list.map((r) => r.id),
            ),
          );
  const approvedByRecap = new Map<string, number>();
  for (const row of artifactCounts) {
    if (row.status === "approved") {
      approvedByRecap.set(
        row.recap_id,
        (approvedByRecap.get(row.recap_id) ?? 0) + 1,
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <EyebrowLabel className="mb-1">QUARTERLY RECAPS</EyebrowLabel>
          <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
            Recaps & marketing artifacts
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
            {list.length} recap{list.length === 1 ? "" : "s"} · gratitude-led
            quarterlies Claude drafts from partner activity
          </p>
        </div>
        <NonprofitRecapCreateActions />
      </div>

      {list.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-6 py-8 text-center">
          <p className="text-[14px] text-ink-subtle">
            No recaps yet. Generate one to start.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline bg-paper">
          {list.map((r, idx) => {
            const approved = approvedByRecap.get(r.id) ?? 0;
            return (
              <Link
                key={r.id}
                href={`/np/recap/${r.id}`}
                className={`flex items-center justify-between gap-3 px-5 py-4 hover:bg-mist ${
                  idx === list.length - 1 ? "" : "border-b border-hairline"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-medium text-ink">
                      {r.period} impact recap
                    </span>
                    <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </StatusPill>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] leading-[1.4] text-ink-faint">
                    <span>Created {formatDate(r.createdAt)}</span>
                    {approved > 0 && (
                      <span>· {approved}/4 artifacts approved</span>
                    )}
                  </div>
                </div>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-ink-faint"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
