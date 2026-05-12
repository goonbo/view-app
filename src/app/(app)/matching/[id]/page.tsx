import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { donations, matchPolicies, nonprofitPartners } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";

type Props = { params: Promise<{ id: string }> };

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

export default async function MatchPolicyDetailPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const [policy] = await db
    .select()
    .from(matchPolicies)
    .where(
      and(eq(matchPolicies.id, id), eq(matchPolicies.corporateWorkspaceId, ws.id)),
    )
    .limit(1);
  if (!policy) notFound();

  const eligibleIds = policy.eligiblePartnerIds as string[];
  const partners = eligibleIds.length
    ? await db
        .select({ id: nonprofitPartners.id, commonName: nonprofitPartners.commonName })
        .from(nonprofitPartners)
        .where(inArray(nonprofitPartners.id, eligibleIds))
    : [];
  const partnerNameById = new Map(partners.map((p) => [p.id, p.commonName]));

  const recent = await db
    .select()
    .from(donations)
    .where(eq(donations.matchPolicyId, policy.id))
    .orderBy(desc(donations.createdAt))
    .limit(20);

  const matched = recent.reduce((s, d) => s + Number(d.matchAmount), 0);
  const cap = policy.capTotal ? Number(policy.capTotal) : null;
  const pct = cap ? Math.min(100, (matched / cap) * 100) : null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/matching"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Matching
        </Link>
        <EyebrowLabel className="mt-2 mb-1">MATCH POLICY</EyebrowLabel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-sans text-[22px] font-medium leading-[1.2] tracking-tight text-ink">
              {policy.name}
            </h1>
            <p className="mt-1 font-mono text-[11px] text-ink-faint">
              {formatDate(policy.startsAt)} – {formatDate(policy.endsAt)}
            </p>
          </div>
          <StatusPill tone={STATUS_TONE[policy.status] ?? "neutral"}>
            {STATUS_LABEL[policy.status] ?? policy.status}
          </StatusPill>
        </div>
      </div>

      <section className="rounded-md border border-hairline bg-paper p-5">
        <EyebrowLabel className="mb-3">POLICY</EyebrowLabel>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Match ratio" mono>
            {Number(policy.matchRatio).toFixed(2)}×
          </Field>
          <Field label="Per-employee cap" mono>
            ${Number(policy.capPerEmployee).toLocaleString()}
          </Field>
          <Field label="Total budget cap" mono>
            {cap !== null ? `$${cap.toLocaleString()}` : "No cap"}
          </Field>
        </dl>

        {cap !== null && (
          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              <span>
                Matched to date · <span className="text-ink">${matched.toLocaleString()}</span> / ${cap.toLocaleString()}
              </span>
              <span>{Math.round(pct ?? 0)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist">
              <div className="h-1.5 bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </section>

      <section>
        <EyebrowLabel className="mb-3">ELIGIBLE PARTNERS · {eligibleIds.length}</EyebrowLabel>
        {eligibleIds.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline bg-mist px-4 py-3 text-[13px] text-ink-subtle">
            No partners attached to this policy.
          </p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline bg-paper">
            {eligibleIds.map((pid) => (
              <li key={pid} className="px-4 py-3 text-[14px] text-ink">
                {partnerNameById.get(pid) ?? "Unknown partner"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <EyebrowLabel className="mb-3">RECENT MATCHED DONATIONS · {recent.length}</EyebrowLabel>
        {recent.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline bg-mist px-4 py-3 text-[13px] text-ink-subtle">
            No matched donations yet. Simulate one from a campaign detail page.
          </p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline bg-paper">
            {recent.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-[14px] text-ink">{d.employeeName}</span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {partnerNameById.get(d.partnerId) ?? "Partner"} · {formatDateShort(d.createdAt)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[14px] text-ink">
                    ${Number(d.amount).toLocaleString()}
                  </span>
                  <span className="ml-2 font-mono text-[12px] text-accent">
                    + ${Number(d.matchAmount).toLocaleString()} match
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-[16px] text-ink" : "text-[14px] text-ink"}>
        {children}
      </dd>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
