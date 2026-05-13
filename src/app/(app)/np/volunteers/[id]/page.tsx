import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { getVolunteerProfile } from "@/lib/volunteer-profile";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { EmployerPill } from "@/components/np/VolunteerList";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";

type Props = { params: Promise<{ id: string }> };

const STATUS_TONE: Record<string, StatusPillTone> = {
  registered: "info",
  checked_in: "success",
  no_show: "warning",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  registered: "Registered",
  checked_in: "Checked in",
  no_show: "No-show",
  cancelled: "Cancelled",
};

export default async function VolunteerProfilePage({ params }: Props) {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/workbench");
  const { id } = await params;
  const email = decodeURIComponent(id);

  const profile = await getVolunteerProfile(ws.id, email);
  if (!profile) notFound();

  const initials = profile.fullName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const lastSync = profile.lastSeenAt;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/np/volunteers"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Volunteers
        </Link>
        <EyebrowLabel className="mt-2 mb-2">VOLUNTEER</EyebrowLabel>
        <div className="flex items-start gap-4">
          <div
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mist font-mono text-[14px] font-medium text-ink-subtle"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-sans text-[22px] font-medium leading-[1.2] tracking-tight text-ink">
              {profile.fullName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-subtle">
              <span className="font-mono text-[12px]">{profile.employeeEmail}</span>
              <span className="text-ink-faint">·</span>
              <EmployerPill
                name={profile.employerName}
                token={profile.employerToken}
              />
            </p>
            <p className="mt-2 font-mono text-[11px] text-ink-faint">
              {profile.totalHours} hours total · {profile.eventCount} events ·
              First seen {formatDate(profile.firstSeenAt)} · Last{" "}
              {formatDate(profile.lastSeenAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Tags */}
      <section>
        <EyebrowLabel className="mb-2">TAGS</EyebrowLabel>
        {profile.tags.length === 0 ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline px-3 py-1 font-mono text-[11px] text-ink-faint hover:bg-mist"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add a tag
          </button>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {profile.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-mist px-2 py-0.5 font-mono text-[11px] text-ink-subtle"
              >
                {t}
              </span>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-hairline px-2 py-0.5 font-mono text-[11px] text-ink-faint hover:bg-mist"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add
            </button>
          </div>
        )}
      </section>

      {/* Nonprofit notes */}
      <section>
        <EyebrowLabel className="mb-2">NONPROFIT NOTES</EyebrowLabel>
        {profile.notes ? (
          <article className="whitespace-pre-line rounded-md border border-hairline bg-paper px-4 py-3 text-[13px] leading-[1.55] text-ink">
            {profile.notes}
          </article>
        ) : (
          <p className="rounded-md border border-dashed border-hairline bg-mist px-4 py-3 text-[13px] text-ink-faint">
            No notes yet.
          </p>
        )}
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add note
        </button>
      </section>

      {/* Event history */}
      <section>
        <EyebrowLabel className="mb-3">EVENT HISTORY</EyebrowLabel>
        {profile.history.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline bg-mist px-4 py-3 text-[13px] text-ink-subtle">
            No events recorded.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-hairline bg-paper">
            {profile.history.map((h, idx) => {
              const isLast = idx === profile.history.length - 1;
              return (
                <Link
                  key={h.eventId}
                  href={`/np/events/${h.eventId}`}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-mist ${
                    isLast ? "" : "border-b border-hairline"
                  }`}
                >
                  <span className="w-20 shrink-0 font-mono text-[11px] text-ink-faint">
                    {formatDate(h.eventDate)}
                  </span>
                  <span className="flex-1 truncate text-[14px] text-ink">
                    {h.eventTitle}
                  </span>
                  <StatusPill tone={STATUS_TONE[h.status] ?? "neutral"}>
                    {STATUS_LABEL[h.status] ?? h.status}
                  </StatusPill>
                  <span className="w-12 text-right font-mono text-[12px] text-ink">
                    {h.hoursLogged !== null ? `${h.hoursLogged}h` : "—"}
                  </span>
                  {h.corporateWorkspaceName && (
                    <span className="hidden md:inline-flex w-32 justify-end font-mono text-[11px] text-ink-faint">
                      {h.corporateWorkspaceName}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Bidirectional source line */}
        <div className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] leading-[1.4] text-ink-faint">
          <Sparkles className="h-3 w-3 text-accent-cyan" aria-hidden />
          Source: hours and check-ins from {profile.employerName} workspace · last
          sync {relTime(lastSync)}
        </div>
      </section>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

function relTime(d: Date): string {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  return `${mo} mo ago`;
}
