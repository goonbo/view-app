import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Plus, ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { donations, matchPolicies } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";

const STATUS_TONE: Record<string, StatusPillTone> = {
  active: "success",
  draft: "neutral",
  paused: "warning",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  paused: "Paused",
};

export default async function MatchingPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const policies = await db
    .select()
    .from(matchPolicies)
    .where(eq(matchPolicies.corporateWorkspaceId, ws.id))
    .orderBy(desc(matchPolicies.createdAt));

  const totals = policies.length
    ? await db
        .select({
          policy_id: donations.matchPolicyId,
          total: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)`,
        })
        .from(donations)
        .where(
          and(
            eq(donations.corporateWorkspaceId, ws.id),
            inArray(
              donations.matchPolicyId,
              policies.map((p) => p.id),
            ),
          ),
        )
        .groupBy(donations.matchPolicyId)
    : [];
  const matchedByPolicy = new Map(totals.map((t) => [t.policy_id, Number(t.total)]));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <EyebrowLabel className="mb-1">MATCHING</EyebrowLabel>
          <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
            Match policies
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
            {policies.length} polic{policies.length === 1 ? "y" : "ies"} · matching gift programs across vetted partners
          </p>
        </div>
        <Button asChild>
          <Link href="/matching/new">
            <Plus className="mr-1 h-3.5 w-3.5" />
            New policy
          </Link>
        </Button>
      </div>

      {policies.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-6 py-8 text-center">
          <p className="text-[14px] text-ink-subtle">No match policies yet.</p>
          <Button asChild className="mt-3" size="sm">
            <Link href="/matching/new">+ Create your first policy</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {policies.map((p) => {
            const matched = matchedByPolicy.get(p.id) ?? 0;
            const cap = p.capTotal ? Number(p.capTotal) : null;
            const pct = cap ? Math.min(100, (matched / cap) * 100) : null;
            return (
              <Link
                key={p.id}
                href={`/matching/${p.id}`}
                className="group flex flex-col gap-3 rounded-md border border-hairline bg-paper p-5 hover:border-ink-faint"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-medium text-ink">{p.name}</h3>
                    <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                      {formatDate(p.startsAt)} – {formatDate(p.endsAt)}
                    </p>
                  </div>
                  <StatusPill tone={STATUS_TONE[p.status] ?? "neutral"}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </StatusPill>
                </div>

                <div className="flex items-center gap-4 font-mono text-[11px] leading-[1.4] text-ink-subtle">
                  <span>
                    <span className="text-ink">{Number(p.matchRatio).toFixed(1)}×</span> match
                  </span>
                  <span>
                    <span className="text-ink">{(p.eligiblePartnerIds as string[]).length}</span> partner
                    {(p.eligiblePartnerIds as string[]).length === 1 ? "" : "s"}
                  </span>
                  <span>
                    ${Number(p.capPerEmployee).toLocaleString()} / employee
                  </span>
                </div>

                {cap !== null && (
                  <div>
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-ink-faint">
                      <span>
                        MATCHED YTD <span className="text-ink">${matched.toLocaleString()}</span> / ${cap.toLocaleString()} cap
                      </span>
                      <span>{Math.round(pct ?? 0)}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-mist">
                      <div className="h-1 bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-1 flex items-center justify-end font-mono text-[11px] text-ink-faint">
                  Open
                  <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
