import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db/client";
import { events, nonprofitPartners } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { Button } from "@/components/ui/button";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { StatusPill, type StatusPillTone } from "@/components/shared/StatusPill";

type EventRow = {
  id: string;
  title: string;
  startsAt: Date;
  capacity: number;
  confirmedCapacity: number | null;
  format: string;
  status: string;
  location: string | null;
  partnerName?: string | null;
};

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

/**
 * Corporate-only events list. Nonprofit viewers were previously served
 * a "your events" surface here; the v2 build moves that to
 * `/np/events` (richer past-events surface with retention + CSAT +
 * flagged-event signals), so this page redirects nonprofit viewers.
 */
export default async function EventsPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type === "nonprofit") redirect("/np/events");

  // Corporate side: events activated through any of the workspace's
  // partners, plus events from vetted partners that the corporate side
  // hasn't yet activated.
  const partners = await db
    .select({
      id: nonprofitPartners.id,
      nonprofitWorkspaceId: nonprofitPartners.nonprofitWorkspaceId,
      commonName: nonprofitPartners.commonName,
      status: nonprofitPartners.status,
    })
    .from(nonprofitPartners)
    .where(eq(nonprofitPartners.corporateWorkspaceId, ws.id));
  const partnerIds = partners.map((p) => p.id).filter(Boolean);
  const vettedWorkspaceIds = partners
    .filter((p) => p.status === "vetted" && p.nonprofitWorkspaceId)
    .map((p) => p.nonprofitWorkspaceId!) as string[];

  let rows: EventRow[] = [];
  if (partnerIds.length || vettedWorkspaceIds.length) {
    const raw = await db
      .select()
      .from(events)
      .where(
        // CROSS_WORKSPACE_READ: corporate reads nonprofit-owned events
        // through the partner relationship.
        partnerIds.length ? inArray(events.partnerId, partnerIds) : and(),
      )
      .orderBy(desc(events.startsAt));
    const partnerById = new Map(partners.map((p) => [p.id, p.commonName]));
    rows = raw.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      capacity: e.capacity,
      confirmedCapacity: e.confirmedCapacity,
      format: e.format,
      status: e.status,
      location: e.location,
      partnerName: e.partnerId ? partnerById.get(e.partnerId) : null,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <EyebrowLabel className="mb-1">EVENTS</EyebrowLabel>
          <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
            Activated events
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink-subtle">
            {rows.length} event{rows.length === 1 ? "" : "s"} from your
            vetted partners — activated and in motion
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-6 py-8 text-center">
          <p className="text-[14px] text-ink-subtle">
            No activated events yet — start from Discover.
          </p>
          <Button asChild className="mt-3" size="sm" variant="outline">
            <Link href="/discover">Open Discover</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline bg-paper">
          {rows.map((e, idx) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-mist ${
                idx === rows.length - 1 ? "" : "border-b border-hairline"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium text-ink">
                    {e.title}
                  </span>
                  <StatusPill tone={STATUS_TONE[e.status] ?? "neutral"}>
                    {STATUS_LABEL[e.status] ?? e.status}
                  </StatusPill>
                </div>
                <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] leading-[1.4] text-ink-faint">
                  <span>{formatDate(e.startsAt)}</span>
                  {e.location && <span>· {e.location}</span>}
                  {e.partnerName && <span>· {e.partnerName}</span>}
                  <span>·</span>
                  <span>
                    {e.confirmedCapacity ?? e.capacity} {e.format}
                  </span>
                </div>
              </div>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-ink-faint"
                aria-hidden
              />
            </Link>
          ))}
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
