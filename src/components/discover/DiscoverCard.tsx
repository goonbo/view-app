import Link from "next/link";
import { ArrowRight, Users, Calendar, MapPin, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/shared/StatusPill";
import { ConcernDot, type ConcernLevel } from "@/components/diligence/ConcernFlag";

export type DiscoverItem = {
  kind: "event" | "campaign";
  id: string;
  title: string;
  description: string;
  partnerName: string;
  partnerConcern?: ConcernLevel | null;
  format?: string;
  causeAreas: string[];
  capacity?: number;
  goalAmount?: number;
  raisedAmount?: number;
  startsAt: Date;
  endsAt?: Date;
  location?: string | null;
  /** Where the "Activate" button goes. */
  activateHref: string;
  status: string;
};

type Props = {
  item: DiscoverItem;
  className?: string;
};

export function DiscoverCard({ item, className }: Props) {
  const isCampaign = item.kind === "campaign";
  const dateLabel = isCampaign
    ? `Through ${formatDate(item.endsAt ?? item.startsAt)}`
    : formatDate(item.startsAt);
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-md border border-hairline bg-paper p-5",
        "transition-colors hover:border-ink-faint",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {item.partnerConcern && <ConcernDot level={item.partnerConcern} />}
          <span className="truncate text-[12px] font-medium text-ink-subtle">
            {item.partnerName}
          </span>
        </div>
        <StatusPill tone={isCampaign ? "info" : "accent"}>
          {isCampaign ? "Campaign" : item.format ?? "Event"}
        </StatusPill>
      </div>

      <div>
        <h3 className="text-[16px] font-medium leading-[1.25] text-ink">
          {item.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.5] text-ink-subtle">
          {item.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] leading-[1.4] text-ink-faint">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" aria-hidden />
          {dateLabel}
        </span>
        {item.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden />
            {item.location}
          </span>
        )}
        {item.capacity && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden />
            {item.capacity}
          </span>
        )}
        {item.goalAmount !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" aria-hidden />
            ${item.goalAmount.toLocaleString()} goal
          </span>
        )}
      </div>

      {isCampaign && item.goalAmount !== undefined && (
        <div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-mist">
            <div
              className="h-1 bg-accent"
              style={{
                width: `${Math.min(100, ((item.raisedAmount ?? 0) / item.goalAmount) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-1 font-mono text-[10px] text-ink-faint">
            ${(item.raisedAmount ?? 0).toLocaleString()} raised
          </div>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {item.causeAreas.slice(0, 2).map((c) => (
            <span
              key={c}
              className="rounded-full bg-mist px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-subtle"
            >
              {c}
            </span>
          ))}
        </div>
        <Link
          href={item.activateHref}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
        >
          {item.status === "activated" ? "View" : "Activate"}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
