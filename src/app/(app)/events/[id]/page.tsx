import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Mail, MessageCircle, Calendar, ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import {
  commsDrafts,
  eventSignups,
  events,
  nonprofitPartners,
} from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { SourceMarker } from "@/components/shared/SourceMarker";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";
import { Button } from "@/components/ui/button";
import { EventLiveSyncSurface } from "@/components/events/EventLiveSyncSurface";

type Props = { params: Promise<{ id: string }> };

const STATUS_TONE: Record<string, StatusPillTone> = {
  open: "info",
  activated: "success",
  in_progress: "accent",
  completed: "neutral",
  recapped: "neutral",
  draft: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  activated: "Activated",
  in_progress: "In progress",
  completed: "Completed",
  recapped: "Recapped",
  draft: "Draft",
};

const KIND_ICON: Record<string, typeof Mail> = {
  email: Mail,
  slack: MessageCircle,
  calendar: Calendar,
};
const KIND_LABEL: Record<string, string> = {
  email: "Email",
  slack: "Slack",
  calendar: "Calendar invite",
};

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const ws = await getActiveWorkspaceOrThrow();

  const [ev] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!ev) notFound();

  const isCorporate = ws.type === "corporate";
  if (isCorporate && ev.nonprofitWorkspaceId !== ev.nonprofitWorkspaceId) {
    // (no-op — placeholder for stricter cross-workspace access checks)
  }
  if (!isCorporate && ev.nonprofitWorkspaceId !== ws.id) {
    redirect("/events");
  }

  // Resolve partner (for corporate side) or self-name (nonprofit side).
  let partnerName = "";
  if (isCorporate) {
    // CROSS_WORKSPACE_READ: corporate reads nonprofit partner metadata
    // via the partner relationship.
    const [partner] = await db
      .select()
      .from(nonprofitPartners)
      .where(
        and(
          eq(nonprofitPartners.corporateWorkspaceId, ws.id),
          eq(nonprofitPartners.nonprofitWorkspaceId, ev.nonprofitWorkspaceId),
        ),
      )
      .limit(1);
    partnerName = partner?.commonName ?? "Partner";
  }

  // Comms drafts (only meaningful for activated events)
  const drafts = await db
    .select()
    .from(commsDrafts)
    .where(eq(commsDrafts.eventId, ev.id));

  // Signups (for capacity tracking)
  const signups = await db
    .select()
    .from(eventSignups)
    .where(eq(eventSignups.eventId, ev.id));
  const registered = signups.filter((s) => s.status === "registered" || s.status === "checked_in").length;

  const corpName = "Acme Robotics"; // TODO: lookup when there are multiple corporate workspaces

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          href={isCorporate ? "/events" : "/events"}
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ink-subtle hover:text-ink"
        >
          ← Events
        </Link>
        <EyebrowLabel className="mt-2 mb-1">EVENT</EyebrowLabel>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-sans text-[24px] font-medium leading-[1.2] tracking-tight text-ink">
              {ev.title}
            </h1>
            <p className="mt-1 text-[14px] leading-[1.5] text-ink-subtle">
              {isCorporate ? (
                <>
                  <SourceMarker origin="nonprofit" fromName={partnerName} className="mr-2" />
                  published this event
                </>
              ) : (
                ev.corporateWorkspaceId ? (
                  <>
                    <SourceMarker origin="corporate" fromName={corpName} className="mr-2" />
                    activated this event
                  </>
                ) : (
                  <>Open to corporate partners</>
                )
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone={STATUS_TONE[ev.status] ?? "neutral"}>
              {STATUS_LABEL[ev.status] ?? ev.status}
            </StatusPill>
            {isCorporate && ev.status === "open" && (
              <Button asChild>
                <Link href={`/events/${ev.id}/activate`}>
                  Activate
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Event details */}
      <section className="rounded-md border border-hairline bg-paper p-5">
        <EyebrowLabel className="mb-3">EVENT DETAILS</EyebrowLabel>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field
            label="When"
            sourceFrom={isCorporate ? partnerName : undefined}
            sourceOrigin={isCorporate ? "nonprofit" : undefined}
          >
            {formatDate(ev.startsAt)} · {formatTime(ev.startsAt)}–{formatTime(ev.endsAt)}
          </Field>
          <Field
            label="Where"
            sourceFrom={isCorporate ? partnerName : undefined}
            sourceOrigin={isCorporate ? "nonprofit" : undefined}
          >
            {ev.location ?? "—"}
          </Field>
          <Field
            label="Capacity"
            sourceFrom={isCorporate ? partnerName : undefined}
            sourceOrigin={isCorporate ? "nonprofit" : undefined}
          >
            <span className="font-mono">
              {ev.confirmedCapacity ? `${registered} / ${ev.confirmedCapacity}` : ev.capacity}
            </span>
            <span className="ml-1 text-ink-subtle">· {ev.format}</span>
          </Field>
          <Field
            label="Cause areas"
            sourceFrom={isCorporate ? partnerName : undefined}
            sourceOrigin={isCorporate ? "nonprofit" : undefined}
          >
            {ev.causeAreas.length ? ev.causeAreas.join(" / ") : "—"}
          </Field>
          <Field
            label="Description"
            full
            sourceFrom={isCorporate ? partnerName : undefined}
            sourceOrigin={isCorporate ? "nonprofit" : undefined}
          >
            <span className="whitespace-pre-line">{ev.description ?? "—"}</span>
          </Field>
        </dl>
      </section>

      {/* Bidirectional live-sync surface: shared notes (editable both
          sides), supplies (editable nonprofit only), signup capacity. */}
      <EventLiveSyncSurface
        eventId={ev.id}
        viewerSide={isCorporate ? "corporate" : "nonprofit"}
        otherSideName={isCorporate ? partnerName : corpName}
        initial={{
          id: ev.id,
          status: ev.status,
          shared_notes: ev.sharedNotes ?? "",
          supplies: (ev.supplies ?? []) as string[],
          capacity: ev.capacity,
          confirmed_capacity: ev.confirmedCapacity,
          registered_count: registered,
          updated_at: ev.updatedAt.toISOString(),
        }}
      />

      {/* Comms (corporate-only) */}
      {isCorporate && drafts.length > 0 && (
        <section className="rounded-md border border-hairline bg-paper p-5">
          <EyebrowLabel className="mb-3">ACTIVATION COMMS</EyebrowLabel>
          <ul className="space-y-3">
            {drafts.map((d) => {
              const Icon = KIND_ICON[d.kind] ?? Mail;
              return (
                <li key={d.id} className="rounded-md border border-hairline bg-mist p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-subtle">
                      <Icon className="h-3 w-3" aria-hidden />
                      {KIND_LABEL[d.kind] ?? d.kind}
                    </span>
                    <StatusPill tone={d.status === "sent" ? "success" : d.status === "approved" ? "info" : "neutral"}>
                      {d.status}
                    </StatusPill>
                  </div>
                  {d.subject && (
                    <p className="text-[13px] font-medium text-ink">{d.subject}</p>
                  )}
                  <p className="whitespace-pre-line text-[12px] leading-[1.5] text-ink-subtle line-clamp-3">
                    {d.body}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  full,
  sourceOrigin,
  sourceFrom,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  sourceOrigin?: "corporate" | "nonprofit";
  sourceFrom?: string;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="mb-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        <span>{label}</span>
        {sourceOrigin && <SourceMarker origin={sourceOrigin} fromName={sourceFrom} />}
      </dt>
      <dd className="text-[14px] text-ink">{children}</dd>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
