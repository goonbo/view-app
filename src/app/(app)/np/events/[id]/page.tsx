import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, MapPin, Sparkles } from "lucide-react";
import { db } from "@/db/client";
import {
  eventSignups,
  events,
  nonprofitEventStats,
  workspaces,
} from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { EmployerPill } from "@/components/np/VolunteerList";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ id: string }> };

const TOKEN_BY_NAME: Record<string, "acme" | "lumen" | "boldfish"> = {
  "Acme Robotics": "acme",
  "Lumen Industries": "lumen",
  "Boldfish Co.": "boldfish",
};

export default async function NonprofitEventDetailPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect(`/events/${id}`);

  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.nonprofitWorkspaceId, ws.id)))
    .limit(1);
  if (!ev) notFound();

  const [stat] = await db
    .select()
    .from(nonprofitEventStats)
    .where(
      and(
        eq(nonprofitEventStats.eventId, ev.id),
        eq(nonprofitEventStats.nonprofitWorkspaceId, ws.id),
      ),
    )
    .limit(1);

  // Signups (with employer attribution).
  const signups = await db
    .select({
      name: eventSignups.employeeName,
      email: eventSignups.employeeEmail,
      status: eventSignups.status,
      hours: eventSignups.hoursLogged,
    })
    .from(eventSignups)
    .where(eq(eventSignups.eventId, ev.id))
    .orderBy(asc(eventSignups.employeeName));

  // Corp workspace name (the partner who activated this event).
  let corpName = "Partner";
  if (ev.corporateWorkspaceId) {
    const [w] = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, ev.corporateWorkspaceId))
      .limit(1);
    if (w) corpName = w.name;
  }
  const corpToken = TOKEN_BY_NAME[corpName] ?? "acme";

  // Employer breakdown across signups (e.g., "11 from Acme, 7 from Lumen").
  const byEmployer = new Map<string, { in: number; no: number }>();
  for (const s of signups) {
    const domain = s.email.split("@")[1] ?? "";
    const employerLabel =
      domain.startsWith("acme")
        ? "Acme Robotics"
        : domain.startsWith("lumen")
          ? "Lumen Industries"
          : domain.startsWith("boldfish")
            ? "Boldfish Co."
            : "Other";
    const bucket = byEmployer.get(employerLabel) ?? { in: 0, no: 0 };
    if (s.status === "checked_in") bucket.in += 1;
    else if (s.status === "no_show") bucket.no += 1;
    byEmployer.set(employerLabel, bucket);
  }

  const retentionPct = stat
    ? Math.round(
        (stat.retentionFollowupCount / Math.max(1, stat.checkedInCount)) * 100,
      )
    : null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/np/events"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Events
        </Link>
        <EyebrowLabel className="mt-2 mb-1">EVENT DETAIL</EyebrowLabel>
        <h1 className="font-sans text-[22px] font-medium leading-[1.2] tracking-tight text-ink">
          {ev.title}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-subtle">
          <span className="font-mono text-[11px] text-ink-faint">
            {formatDate(ev.startsAt)}
          </span>
          <span className="text-ink-faint">·</span>
          <EmployerPill name={corpName} token={corpToken} />
          {ev.location && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-faint">
                <MapPin className="h-3 w-3" aria-hidden />
                {ev.location}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Stats grid */}
      {stat && (
        <section className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Stat label="SIGNUPS" value={stat.signupCount} />
          <Stat label="CHECKED IN" value={stat.checkedInCount} />
          <Stat
            label="NO-SHOWS"
            value={stat.noShowCount}
            tone={stat.noShowCount > 10 ? "warning" : undefined}
          />
          <Stat label="HOURS" value={stat.totalHours} />
          <Stat
            label="RETENTION"
            value={retentionPct !== null ? `${retentionPct}%` : "—"}
            sub="came back ≤ 90d"
          />
          <Stat
            label="CSAT"
            value={
              stat.satisfactionAvg
                ? Number(stat.satisfactionAvg).toFixed(1)
                : "—"
            }
            tone={
              stat.satisfactionAvg && Number(stat.satisfactionAvg) < 4.0
                ? "warning"
                : undefined
            }
            sub={
              stat.satisfactionResponseRate
                ? `${Math.round(
                    Number(stat.satisfactionResponseRate) * 100,
                  )}% responded`
                : undefined
            }
          />
        </section>
      )}

      {/* Description */}
      {ev.description && (
        <section className="rounded-md border border-hairline bg-paper p-5">
          <EyebrowLabel className="mb-2">DESCRIPTION</EyebrowLabel>
          <p className="whitespace-pre-line text-[14px] leading-[1.6] text-ink">
            {ev.description}
          </p>
        </section>
      )}

      {/* Claude no-show analysis */}
      {stat?.noShowAnalysisMd && (
        <section className="rounded-md border border-hairline bg-paper p-5">
          <div className="mb-3 flex items-center gap-2">
            <EyebrowLabel>NO-SHOW ANALYSIS</EyebrowLabel>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-accent-cyan">
              <Sparkles className="h-3 w-3" aria-hidden />
              Claude drafted
            </span>
          </div>
          <p className="whitespace-pre-line text-[14px] leading-[1.65] text-ink">
            {stat.noShowAnalysisMd}
          </p>
        </section>
      )}

      {/* Employer breakdown */}
      {byEmployer.size > 0 && (
        <section>
          <EyebrowLabel className="mb-2">CORPORATE PARTNER BREAKDOWN</EyebrowLabel>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {Array.from(byEmployer.entries()).map(([name, counts]) => (
              <article
                key={name}
                className="flex items-center justify-between rounded-md border border-hairline bg-paper px-4 py-3"
              >
                <EmployerPill
                  name={name}
                  token={TOKEN_BY_NAME[name] ?? "acme"}
                />
                <span className="font-mono text-[12px] text-ink-subtle">
                  <span className="text-ink">{counts.in}</span> in ·{" "}
                  <span className={counts.no > 0 ? "text-warning" : ""}>
                    {counts.no}
                  </span>{" "}
                  no-show
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Signups roster */}
      <section>
        <EyebrowLabel className="mb-2">VOLUNTEER ROSTER · {signups.length}</EyebrowLabel>
        <div className="overflow-hidden rounded-md border border-hairline bg-paper">
          {signups.map((s, i) => (
            <Link
              key={s.email}
              href={`/np/volunteers/${encodeURIComponent(s.email)}`}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-mist ${
                i !== signups.length - 1 ? "border-b border-hairline" : ""
              }`}
            >
              <span className="text-[14px] text-ink">{s.name}</span>
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    s.status === "no_show"
                      ? "text-warning"
                      : s.status === "checked_in"
                        ? "text-success"
                        : "text-ink-subtle",
                  )}
                >
                  {s.status === "checked_in"
                    ? "checked in"
                    : s.status === "no_show"
                      ? "no-show"
                      : s.status}
                </span>
                <span className="w-12 text-right font-mono text-[11px] text-ink-subtle">
                  {s.hours !== null ? `${Number(s.hours)}h` : "—"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Bidirectional source line */}
      <p className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
        <Sparkles className="h-3 w-3 text-accent-cyan" aria-hidden />
        Source: signups + check-ins + hours from {corpName} workspace
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "warning";
}) {
  return (
    <article className="rounded-md border border-hairline bg-paper px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[20px] font-medium leading-tight",
          tone === "warning" ? "text-warning" : "text-ink",
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-[10px] text-ink-faint">{sub}</div>
      )}
    </article>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
