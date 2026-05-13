import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { events, nonprofitEventStats } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { cn } from "@/lib/utils";

export default async function NonprofitEventsPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/events");

  const rows = await db
    .select({
      event: events,
      stat: nonprofitEventStats,
    })
    .from(events)
    .leftJoin(
      nonprofitEventStats,
      and(
        eq(nonprofitEventStats.eventId, events.id),
        eq(nonprofitEventStats.nonprofitWorkspaceId, ws.id),
      ),
    )
    .where(
      and(
        eq(events.nonprofitWorkspaceId, ws.id),
        lt(events.startsAt, new Date()),
      ),
    )
    .orderBy(desc(events.startsAt));

  return (
    <div className="space-y-5">
      <div>
        <EyebrowLabel className="mb-1">EVENTS</EyebrowLabel>
        <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
          {rows.length} past events
        </h1>
        <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
          Signups, check-ins, hours, retention, and CSAT — same data as the
          corporate side, surfaced for nonprofit operations.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-5 py-6 text-center">
          <p className="text-[13px] text-ink-subtle">No past events yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline bg-paper">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <TH className="text-left">Name</TH>
                <TH className="text-left">Date</TH>
                <TH className="text-right">Signup</TH>
                <TH className="text-right">In</TH>
                <TH className="text-right">No-show</TH>
                <TH className="text-right">Hours</TH>
                <TH className="text-right">Retention</TH>
                <TH className="text-right">CSAT</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const s = r.stat;
                const flagged =
                  s !== null &&
                  Number(s.satisfactionAvg ?? 0) > 0 &&
                  Number(s.satisfactionAvg ?? 0) < 4.0;
                return (
                  <tr
                    key={r.event.id}
                    className={cn(
                      "transition-colors hover:bg-mist",
                      i !== rows.length - 1 && "border-b border-hairline",
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/np/events/${r.event.id}`}
                        className="text-[14px] text-ink hover:underline"
                      >
                        {r.event.title}
                      </Link>
                      {flagged && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
                          flagged
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-faint">
                      {formatDate(r.event.startsAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-ink">
                      {s?.signupCount ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-ink">
                      {s?.checkedInCount ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono text-[13px]",
                        s && s.noShowCount > 10 ? "text-warning" : "text-ink",
                      )}
                    >
                      {s?.noShowCount ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-ink">
                      {s?.totalHours ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[13px] text-ink-subtle">
                      {s
                        ? `${Math.round((s.retentionFollowupCount / Math.max(1, s.checkedInCount)) * 100)}%`
                        : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono text-[13px]",
                        flagged ? "text-warning" : "text-ink",
                      )}
                    >
                      {s?.satisfactionAvg
                        ? Number(s.satisfactionAvg).toFixed(1)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="font-mono text-[11px] text-ink-faint">
        ▲ flagged: CSAT under 4.0 or no-show rate over 30%. Claude writes a
        no-show analysis paragraph on each flagged event.
      </p>
    </div>
  );
}

function TH({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}
