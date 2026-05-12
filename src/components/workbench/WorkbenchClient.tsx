"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  Mail,
  FileText,
  Megaphone,
  ChevronRight,
  Clock,
  CheckSquare,
  Square,
  Calendar,
  Heart,
  MapPin,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { ConcernDot } from "@/components/diligence/ConcernFlag";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { cn } from "@/lib/utils";
import type {
  WorkbenchFeed,
  PendingReviewItem,
  UpcomingItem,
  ActiveCampaignItem,
  PartnerActivityItem,
  RecentlyShippedRow,
} from "@/app/api/workbench/feed/route";
import { toast } from "sonner";

const ICON: Record<PendingReviewItem["kind"], typeof Sparkles> = {
  diligence: ShieldCheck,
  comms: Mail,
  event_open: Calendar,
  campaign_open: Heart,
  recap: FileText,
};

const ACTIVITY_ICON: Record<PartnerActivityItem["kind"], typeof Megaphone> = {
  event_published: Calendar,
  campaign_published: Heart,
  supplies_updated: ShieldCheck,
  notes_updated: FileText,
  event_completed: Megaphone,
  donation_thanks: Sparkles,
};

type Props = {
  firstName: string;
  initial: WorkbenchFeed;
};

export function WorkbenchClient({ firstName, initial }: Props) {
  const { data } = useLiveData<WorkbenchFeed>(
    `workbench-feed`,
    async () => {
      const res = await fetch("/api/workbench/feed");
      if (!res.ok) throw new Error(`feed ${res.status}`);
      return (await res.json()) as WorkbenchFeed;
    },
    { intervalMs: 4000, initial },
  );
  const feed = data ?? initial;
  return (
    <div className="space-y-10">
      <Header
        firstName={firstName}
        pendingCount={feed.pending_review.length}
        nextEvent={feed.next_event_summary}
      />
      <AmbientStatsRow stats={feed.ambient_stats} />
      <PendingReviewSection items={feed.pending_review} />
      <UpcomingSection items={feed.upcoming} />
      <ActiveCampaignsSection items={feed.active_campaigns} />
      <PartnerActivitySection items={feed.partner_activity} />
      <RecentlyShippedFooter row={feed.recently_shipped} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Header

function Header({
  firstName,
  pendingCount,
  nextEvent,
}: {
  firstName: string;
  pendingCount: number;
  nextEvent: WorkbenchFeed["next_event_summary"];
}) {
  return (
    <header>
      <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
        Good morning, {firstName}
      </h1>
      <p className="mt-1 text-[12px] leading-[1.4] text-ink-subtle">
        {pendingCount} item{pendingCount === 1 ? "" : "s"} waiting for your review
        {nextEvent && (
          <>
            {" · "}
            <span className="text-ink">{nextEvent.title}</span> is in {nextEvent.days_until} day
            {nextEvent.days_until === 1 ? "" : "s"}
          </>
        )}
      </p>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Ambient stats row

function AmbientStatsRow({ stats }: { stats: WorkbenchFeed["ambient_stats"] }) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <StatCard
        label="Q HOURS"
        value={String(stats.quarter_hours.value)}
        delta={stats.quarter_hours.delta_label}
        deltaTone={stats.quarter_hours.value > 0 ? "success" : "muted"}
      />
      <StatCard
        label="MATCHED YTD"
        value={`$${stats.matched_ytd.value.toLocaleString()}`}
        delta={stats.matched_ytd.delta_label}
      />
      <StatCard
        label="ACTIVE PARTNERS"
        value={String(stats.active_partners.value)}
        delta={stats.active_partners.delta_label}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  deltaTone = "muted",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "success" | "muted";
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
        <div
          className={cn(
            "mt-0.5 font-mono text-[10px]",
            deltaTone === "success" ? "text-success" : "text-ink-faint",
          )}
        >
          {delta}
        </div>
      )}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// Pending review (with bulk-select + snooze)

function PendingReviewSection({
  items,
}: {
  items: PendingReviewItem[];
}) {
  const router = useRouter();
  const [bulkMode, setBulkMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        (e.key === "A" || e.key === "a") &&
        !e.repeat &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        setBulkMode((m) => !m);
        if (bulkMode) setSelected(new Set());
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [bulkMode]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function snoozeSelected() {
    const targets = items.filter((it) => selected.has(it.id));
    await Promise.all(
      targets.map((it) =>
        fetch("/api/snoozes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_type: it.kind === "recap" ? "recap" : it.kind === "comms" ? "comms" : "diligence",
            target_id: it.target_id,
            until: "next_week",
          }),
        }),
      ),
    );
    toast.success(`Snoozed ${targets.length} item${targets.length === 1 ? "" : "s"} until next week`);
    setBulkMode(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <EyebrowLabel>
          PENDING YOUR REVIEW · {items.length} item{items.length === 1 ? "" : "s"} · ⇧A bulk-select
        </EyebrowLabel>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-5 py-6 text-center">
          <p className="text-[13px] text-ink-subtle">Nothing waiting. Inbox zero.</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-md border border-hairline bg-paper">
            {items.map((it, idx) => (
              <PendingRow
                key={it.id}
                item={it}
                bulkMode={bulkMode}
                selected={selected.has(it.id)}
                onToggle={() => toggle(it.id)}
                last={idx === items.length - 1}
              />
            ))}
          </div>
          {bulkMode && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-4 py-2">
              <div className="font-mono text-[11px] text-accent">
                {selected.size} of {items.length} selected
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setBulkMode(false); setSelected(new Set()); }}>
                  Cancel
                </Button>
                <Button size="sm" variant="outline" onClick={snoozeSelected} disabled={!selected.size}>
                  Snooze {selected.size} selected
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PendingRow({
  item,
  bulkMode,
  selected,
  onToggle,
  last,
}: {
  item: PendingReviewItem;
  bulkMode: boolean;
  selected: boolean;
  onToggle: () => void;
  last: boolean;
}) {
  const Icon = ICON[item.kind] ?? Sparkles;
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3",
        last ? "" : "border-b border-hairline",
        "hover:bg-mist",
      )}
    >
      {bulkMode && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 text-ink-faint hover:text-ink"
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-accent" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className="flex flex-1 items-start gap-3"
            onClick={(e) => {
              if (bulkMode) {
                e.preventDefault();
                onToggle();
              }
            }}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[14px] font-medium text-ink">
                  {item.title}
                </span>
                {item.concern_level && (
                  <ConcernDot level={item.concern_level} />
                )}
              </div>
              <p className="mt-0.5 line-clamp-1 text-[12px] leading-[1.45] text-ink-subtle">
                {item.reasoning}
              </p>
              <div className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] leading-[1.4] text-ink-faint">
                <Sparkles className="h-3 w-3 text-accent-cyan" aria-hidden />
                Claude drafted · {item.drafted_label}
                <SnoozeButton item={item} />
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[320px]">
          <span className="text-[12px] leading-[1.45]">{item.reasoning}</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function SnoozeButton({ item }: { item: PendingReviewItem }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  async function snooze(until: "tomorrow" | "next_week") {
    await fetch("/api/snoozes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_type: item.kind === "recap" ? "recap" : item.kind === "comms" ? "comms" : "diligence",
        target_id: item.target_id,
        until,
      }),
    });
    setOpen(false);
    toast.success(`Snoozed until ${until === "tomorrow" ? "tomorrow" : "next week"}`);
    router.refresh();
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="hover:text-ink"
        >
          <span className="ml-1 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Snooze
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-40 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="block w-full rounded-sm px-2 py-1.5 text-left text-[12px] hover:bg-mist"
          onClick={() => snooze("tomorrow")}
        >
          Until tomorrow
        </button>
        <button
          type="button"
          className="block w-full rounded-sm px-2 py-1.5 text-left text-[12px] hover:bg-mist"
          onClick={() => snooze("next_week")}
        >
          Until next week
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────
// Upcoming

function UpcomingSection({ items }: { items: UpcomingItem[] }) {
  return (
    <section>
      <EyebrowLabel className="mb-3">UPCOMING · 2 weeks</EyebrowLabel>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-5 py-6 text-center">
          <p className="text-[13px] text-ink-subtle">No activated events in the next 2 weeks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-paper p-4 hover:border-ink-faint"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-ink">{e.title}</div>
                <div className="mt-0.5 text-[12px] text-ink-subtle">{e.partnerName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-faint">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" aria-hidden />
                    {formatDate(e.startsAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden />
                    {e.signupRatio.registered}/{e.signupRatio.capacity}
                  </span>
                  {e.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      <span className="truncate">{e.location}</span>
                    </span>
                  )}
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent-soft)] px-2 py-1 font-mono text-[10px] text-accent">
                in {e.daysUntil} day{e.daysUntil === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Active campaigns

function ActiveCampaignsSection({ items }: { items: ActiveCampaignItem[] }) {
  return (
    <section>
      <EyebrowLabel className="mb-3">ACTIVE CAMPAIGNS</EyebrowLabel>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-5 py-6 text-center">
          <p className="text-[13px] text-ink-subtle">No active donation campaigns.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => {
            const pct = Math.min(100, (c.raised / c.goal) * 100);
            return (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="block rounded-md border border-hairline bg-paper p-4 hover:border-ink-faint"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-medium text-ink">{c.title}</div>
                    <div className="text-[12px] text-ink-subtle">{c.partnerName}</div>
                  </div>
                  <div className="font-mono text-[11px] text-ink-subtle">
                    <span className="text-ink">${c.raised.toLocaleString()}</span> of $
                    {c.goal.toLocaleString()} · {Math.round(pct)}%
                  </div>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-mist">
                  <div className="h-1 bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Partner activity

function PartnerActivitySection({ items }: { items: PartnerActivityItem[] }) {
  return (
    <section>
      <EyebrowLabel className="mb-3">FROM YOUR PARTNERS · last 7 days</EyebrowLabel>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-5 py-6 text-center">
          <p className="text-[13px] text-ink-subtle">Quiet week.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline bg-paper">
          {items.map((row, idx) => {
            const Icon = ACTIVITY_ICON[row.kind] ?? Megaphone;
            return (
              <div
                key={row.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-2.5",
                  idx === items.length - 1 ? "" : "border-b border-hairline",
                )}
              >
                <span
                  aria-hidden
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green"
                />
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
                <span className="flex-1 text-[13px] leading-[1.5] text-ink">{row.message}</span>
                <span className="font-mono text-[11px] leading-[1.4] text-ink-faint">
                  {relTime(row.at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Recently shipped

function RecentlyShippedFooter({ row }: { row: RecentlyShippedRow | null }) {
  if (!row) return null;
  return (
    <div className="rounded-md bg-mist px-4 py-2.5">
      <div className="font-mono text-[11px] leading-[1.4] text-ink-subtle">
        Last shipped:{" "}
        <Link href={`/recaps/${row.recap_id}`} className="text-ink hover:underline">
          {row.title}
        </Link>{" "}
        · {row.artifact_count} artifact{row.artifact_count === 1 ? "" : "s"} approved · {relTime(row.approved_at)}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relTime(iso: string): string {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  return `${mo} mo ago`;
}
