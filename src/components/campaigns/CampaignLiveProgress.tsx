"use client";

import * as React from "react";
import { SourceMarker } from "@/components/shared/SourceMarker";
import { useLiveData } from "@/lib/hooks/use-live-data";
import { cn } from "@/lib/utils";

export type CampaignProgressPayload = {
  campaign: {
    id: string;
    title: string;
    goal_amount: number;
    status: string;
  };
  totals: {
    raised: number;
    donations_amount: number;
    match_amount: number;
    donor_count: number;
  };
  recent: Array<{
    id: string;
    employee_name: string;
    amount: number;
    match_amount: number;
    corporate_workspace_id: string;
    status: string;
    created_at: string;
  }>;
};

type Props = {
  campaignId: string;
  goalAmount: number;
  initial: CampaignProgressPayload;
  /** Show "Match from {corp}" pills on the donations list. Set true on the nonprofit side. */
  showMatchSource?: boolean;
  /** Map of corporate_workspace_id → display name for source pills. */
  corporateNameById?: Record<string, string>;
};

/**
 * Live-polled progress block. Bidirectional sync — corporate and nonprofit
 * pages mount the same component and see identical totals updated every
 * 2 seconds.
 */
export function CampaignLiveProgress({
  campaignId,
  goalAmount,
  initial,
  showMatchSource,
  corporateNameById = {},
}: Props) {
  const { data, tick } = useLiveData<CampaignProgressPayload>(
    `campaign-progress-${campaignId}`,
    async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/progress?scope=all`);
      if (!res.ok) throw new Error(`progress fetch ${res.status}`);
      return (await res.json()) as CampaignProgressPayload;
    },
    { intervalMs: 2000, initial },
  );

  const totals = data?.totals ?? initial.totals;
  const recent = data?.recent ?? initial.recent;
  const pct = Math.min(100, (totals.raised / goalAmount) * 100);

  // Flash the progress bar when the polled value changes from the prior tick.
  const prevRaisedRef = React.useRef<number>(initial.totals.raised);
  const [flashing, setFlashing] = React.useState(false);
  React.useEffect(() => {
    if (totals.raised !== prevRaisedRef.current) {
      prevRaisedRef.current = totals.raised;
      setFlashing(true);
      const t = window.setTimeout(() => setFlashing(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [totals.raised, tick]);

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-hairline bg-paper p-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Raised
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[28px] font-medium leading-none text-ink">
                ${totals.raised.toLocaleString()}
              </span>
              <span className="text-[14px] text-ink-subtle">
                of ${goalAmount.toLocaleString()} goal
              </span>
            </div>
          </div>
          <div className="text-right font-mono text-[11px] text-ink-subtle">
            <div>{Math.round(pct)}%</div>
            <div className="text-ink-faint">{totals.donor_count} donor{totals.donor_count === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div
          className={cn(
            "h-2 w-full overflow-hidden rounded-full transition-colors",
            flashing ? "bg-[var(--accent-soft)]" : "bg-mist",
          )}
        >
          <div
            className="h-2 bg-accent transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-ink-faint">
          <span>
            <span className="text-ink-subtle">${totals.donations_amount.toLocaleString()}</span>{" "}
            donations
          </span>
          <span>
            <span className="text-ink-subtle">${totals.match_amount.toLocaleString()}</span>{" "}
            in matches
          </span>
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
            Recent donations
          </div>
          <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline bg-paper">
            {recent.map((d) => {
              const matchCorpName = corporateNameById[d.corporate_workspace_id];
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-[14px] text-ink">{d.employee_name}</span>
                    <span className="font-mono text-[11px] text-ink-faint">
                      {formatTime(d.created_at)}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[14px] text-ink">
                      ${d.amount.toLocaleString()}
                    </div>
                    {d.match_amount > 0 && (
                      <div className="mt-0.5 flex items-center justify-end gap-1.5 font-mono text-[11px] text-accent">
                        + ${d.match_amount.toLocaleString()} match
                        {showMatchSource && matchCorpName && (
                          <SourceMarker origin="corporate" fromName={`from ${matchCorpName}`} />
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
