"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export type VolunteerListItem = {
  employeeEmail: string;
  fullName: string;
  employerWorkspaceId: string;
  employerName: string;
  employerToken: "acme" | "lumen" | "boldfish";
  totalHours: number;
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  tags: string[];
  notes: string | null;
  capacitySignal: string | null;
};

type Props = {
  profiles: VolunteerListItem[];
  tags: string[];
  initialFilters: {
    employer: string;
    tag: string;
    frequency: string;
  };
};

const FREQUENCY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "regular", label: "5+ events" },
  { value: "occasional", label: "2-4 events" },
  { value: "first-or-second", label: "1-2 events" },
];

export function VolunteerList({ profiles, tags, initialFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const employer = params.get("employer") ?? initialFilters.employer;
  const tag = params.get("tag") ?? initialFilters.tag;
  const frequency = params.get("frequency") ?? initialFilters.frequency;

  const employers = React.useMemo(() => {
    const set = new Map<string, string>();
    for (const p of profiles) set.set(p.employerWorkspaceId, p.employerName);
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [profiles]);

  const filtered = profiles.filter((p) => {
    if (employer !== "all" && p.employerWorkspaceId !== employer) return false;
    if (tag !== "all" && !p.tags.includes(tag)) return false;
    if (frequency === "regular" && p.eventCount < 5) return false;
    if (frequency === "occasional" && (p.eventCount < 2 || p.eventCount > 4))
      return false;
    if (frequency === "first-or-second" && p.eventCount > 2) return false;
    return true;
  });

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, {
      scroll: false,
    });
  };

  const reset = () => router.replace(pathname, { scroll: false });
  const hasFilters = employer !== "all" || tag !== "all" || frequency !== "all";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
        <FilterGroup
          label="Employer"
          value={employer}
          options={[
            { value: "all", label: "All employers" },
            ...employers.map((e) => ({ value: e.id, label: e.name })),
          ]}
          onChange={(v) => setParam("employer", v, "all")}
        />
        <FilterGroup
          label="Tag"
          value={tag}
          options={[
            { value: "all", label: "All tags" },
            ...tags.map((t) => ({ value: t, label: t })),
          ]}
          onChange={(v) => setParam("tag", v, "all")}
        />
        <FilterGroup
          label="Frequency"
          value={frequency}
          options={FREQUENCY_OPTIONS}
          onChange={(v) => setParam("frequency", v, "all")}
        />
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="ml-1 font-mono text-[11px] uppercase tracking-wider text-ink-faint hover:text-ink"
          >
            Clear
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-faint">
          Showing {filtered.length} of {profiles.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline bg-mist px-5 py-6 text-center">
          <p className="text-[13px] text-ink-subtle">No volunteers match.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-hairline bg-paper">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <TH className="text-left">Name</TH>
                <TH className="text-left">Employer</TH>
                <TH className="text-right">Hours</TH>
                <TH className="text-right">Events</TH>
                <TH className="text-left">Last seen</TH>
                <TH className="text-left">Tags</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.employeeEmail}
                  className={cn(
                    "transition-colors hover:bg-mist",
                    i !== filtered.length - 1 && "border-b border-hairline",
                  )}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/np/volunteers/${encodeURIComponent(p.employeeEmail)}`}
                      className="text-[14px] text-ink hover:underline"
                    >
                      {p.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <EmployerPill name={p.employerName} token={p.employerToken} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-ink">
                    {p.totalHours}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-ink">
                    {p.eventCount}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-faint">
                    {formatDate(p.lastSeenAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-mist px-2 py-0.5 font-mono text-[10px] text-ink-subtle"
                        >
                          {t}
                        </span>
                      ))}
                      {p.tags.length > 3 && (
                        <span className="font-mono text-[10px] text-ink-faint">
                          +{p.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-hairline bg-paper px-2 py-1 text-[12px] text-ink hover:bg-mist focus-visible:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EmployerPill({
  name,
  token,
}: {
  name: string;
  token: "acme" | "lumen" | "boldfish";
}) {
  const colorVar =
    token === "acme"
      ? "var(--color-partner-acme)"
      : token === "lumen"
        ? "var(--color-partner-lumen)"
        : "var(--color-partner-boldfish)";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: colorVar }}
      />
      {name}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}
