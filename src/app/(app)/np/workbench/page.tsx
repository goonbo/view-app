import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  ArrowRight,
  Calendar,
  Sparkles,
  Users,
  FileText,
  Tag,
  ShieldCheck,
} from "lucide-react";
import { db } from "@/db/client";
import {
  eventSignups,
  events,
  nonprofitEventStats,
  nonprofitRecaps,
} from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { listVolunteerProfiles } from "@/lib/volunteer-profile";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";

export default async function NonprofitWorkbenchPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/workbench");

  const now = new Date();
  const quarterStart = startOfQuarter(now);

  // Ambient stats
  const volunteers = await listVolunteerProfiles(ws.id);

  const [hoursRow] = await db
    .select({
      hours: sql<string>`COALESCE(SUM(${nonprofitEventStats.totalHours}), 0)`,
    })
    .from(nonprofitEventStats)
    .innerJoin(events, eq(events.id, nonprofitEventStats.eventId))
    .where(
      and(
        eq(nonprofitEventStats.nonprofitWorkspaceId, ws.id),
        gte(events.startsAt, quarterStart),
      ),
    );

  // Distinct partner workspaces (employers represented in volunteer base)
  const partnerCount = new Set(volunteers.map((v) => v.employerWorkspaceId)).size;

  // Next upcoming event
  const [nextEvent] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.nonprofitWorkspaceId, ws.id),
        gte(events.startsAt, now),
      ),
    )
    .orderBy(events.startsAt)
    .limit(1);

  const nextEventSignupCount = nextEvent
    ? await db
        .select({ c: sql<string>`COUNT(*)` })
        .from(eventSignups)
        .where(eq(eventSignups.eventId, nextEvent.id))
    : null;

  // Pending review: Q-recap not yet drafted/approved + any flagged event stats
  const [latestRecap] = await db
    .select()
    .from(nonprofitRecaps)
    .where(eq(nonprofitRecaps.nonprofitWorkspaceId, ws.id))
    .orderBy(desc(nonprofitRecaps.createdAt))
    .limit(1);

  // Flagged events — low CSAT / high no-show
  const flaggedStatsRows = await db
    .select({
      stat: nonprofitEventStats,
      eventId: events.id,
      eventTitle: events.title,
    })
    .from(nonprofitEventStats)
    .innerJoin(events, eq(events.id, nonprofitEventStats.eventId))
    .where(
      and(
        eq(nonprofitEventStats.nonprofitWorkspaceId, ws.id),
        lt(nonprofitEventStats.satisfactionAvg, "4.0"),
      ),
    )
    .limit(3);

  const newVolunteersThisQ = volunteers.filter(
    (v) => v.firstSeenAt >= quarterStart,
  ).length;

  // Headline period for the Q-recap prompt
  const period = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;

  const pendingItems: PendingItem[] = [];
  if (!latestRecap || latestRecap.status !== "approved") {
    pendingItems.push({
      kind: "recap",
      title: `${period} impact recap`,
      reason: `Ready to draft · ${Math.round(Number(hoursRow.hours))} hours, ${
        volunteers.length
      } volunteers, ${partnerCount} corporate partners`,
      meta: "Claude will draft · ~30s",
      href: latestRecap ? `/np/recap/${latestRecap.id}` : "/np/recaps",
      concern: "info",
    });
  }
  for (const f of flaggedStatsRows) {
    pendingItems.push({
      kind: "flagged_event",
      title: `${f.stat.noShowCount} no-shows from ${f.eventTitle}`,
      reason: `Reconciliation flagged · CSAT ${Number(f.stat.satisfactionAvg ?? 0).toFixed(1)} / 5`,
      meta: "Claude wrote no-show analysis",
      href: `/np/events/${f.eventId}`,
      concern: "warning",
    });
  }
  if (newVolunteersThisQ > 0) {
    pendingItems.push({
      kind: "new_volunteers",
      title: `${newVolunteersThisQ} new volunteers this quarter`,
      reason: "Tag them and add notes — pristine first-time signups",
      meta: "From your CRM",
      href: "/np/volunteers?frequency=first-or-second",
      concern: "info",
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
          Good morning, {ws.primaryUser.firstName}
        </h1>
        <p className="mt-1 text-[12px] leading-[1.4] text-ink-subtle">
          {pendingItems.length > 0
            ? `${pendingItems.length} thing${pendingItems.length === 1 ? "" : "s"} waiting · `
            : ""}
          {nextEvent ? (
            <>
              <span className="text-ink">{nextEvent.title}</span> is{" "}
              {daysUntil(nextEvent.startsAt)} days out
            </>
          ) : (
            "No upcoming events"
          )}
        </p>
      </header>

      {/* Ambient stats — 4 tiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          label="ACTIVE VOLUNTEERS"
          value={String(volunteers.length)}
          delta={
            newVolunteersThisQ > 0
              ? `+${newVolunteersThisQ} this quarter`
              : "no change"
          }
        />
        <StatCard
          label={`${period.split(" ")[0]} HOURS`}
          value={Number(hoursRow.hours ?? 0).toLocaleString()}
          delta="vs prior quarter"
        />
        <StatCard
          label="CORPORATE PARTNERS"
          value={String(partnerCount)}
          delta={partnerCount === 1 ? "Acme" : `Acme + ${partnerCount - 1}`}
        />
        <StatCard
          label="NEXT EVENT"
          value={
            nextEvent
              ? `${daysUntil(nextEvent.startsAt)}d`
              : "—"
          }
          delta={
            nextEvent && nextEventSignupCount
              ? `${Number(nextEventSignupCount[0]?.c ?? 0)} signed up`
              : ""
          }
        />
      </div>

      {/* Pending review */}
      <section>
        <EyebrowLabel className="mb-3">
          PENDING YOUR REVIEW · {pendingItems.length}
        </EyebrowLabel>
        {pendingItems.length === 0 ? (
          <div className="rounded-md border border-dashed border-hairline bg-mist px-5 py-6 text-center">
            <p className="text-[13px] text-ink-subtle">
              Nothing waiting. Inbox zero.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-hairline bg-paper">
            {pendingItems.map((p, i) => (
              <PendingRow
                key={`${p.kind}-${i}`}
                item={p}
                last={i === pendingItems.length - 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick links — events, volunteers, recaps */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <QuickLink
          href="/np/volunteers"
          icon={Users}
          title="Volunteer CRM"
          subtitle={`${volunteers.length} active across ${partnerCount} partners`}
        />
        <QuickLink
          href="/np/events"
          icon={Calendar}
          title="Past events"
          subtitle={`${flaggedStatsRows.length > 0 ? `${flaggedStatsRows.length} flagged · ` : ""}detailed stats per event`}
        />
        <QuickLink
          href="/np/recaps"
          icon={FileText}
          title="Recaps & artifacts"
          subtitle="Quarterly impact narratives + donor materials"
        />
      </section>
    </div>
  );
}

type PendingItem = {
  kind: "recap" | "flagged_event" | "new_volunteers";
  title: string;
  reason: string;
  meta: string;
  href: string;
  concern: "info" | "warning";
};

function PendingRow({ item, last }: { item: PendingItem; last: boolean }) {
  const Icon =
    item.kind === "recap"
      ? FileText
      : item.kind === "flagged_event"
        ? ShieldCheck
        : Tag;
  return (
    <Link
      href={item.href}
      className={`flex items-start gap-3 px-4 py-3 hover:bg-mist ${
        last ? "" : "border-b border-hairline"
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          item.concern === "warning" ? "text-warning" : "text-accent"
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{item.title}</div>
        <p className="mt-0.5 text-[12px] leading-[1.45] text-ink-subtle">
          {item.reason}
        </p>
        <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
          <Sparkles className="h-3 w-3 text-accent-cyan" aria-hidden />
          {item.meta}
        </div>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
    </Link>
  );
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <article className="rounded-md border border-hairline bg-paper px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className="mt-1 font-mono text-[20px] font-medium leading-tight text-ink">
        {value}
      </div>
      {delta && (
        <div className="mt-0.5 font-mono text-[10px] text-ink-faint">
          {delta}
        </div>
      )}
    </article>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-md border border-hairline bg-paper p-4 hover:border-ink-faint"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[12px] text-ink-subtle">{subtitle}</div>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 text-ink-faint" aria-hidden />
    </Link>
  );
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function daysUntil(d: Date): number {
  return Math.max(
    0,
    Math.ceil((d.getTime() - Date.now()) / 86_400_000),
  );
}
