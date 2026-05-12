"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const KIND_OPTIONS: Option[] = [
  { value: "all", label: "All" },
  { value: "events", label: "Volunteer events" },
  { value: "campaigns", label: "Donation campaigns" },
];

const TIME_OPTIONS: Option[] = [
  { value: "any", label: "Any time" },
  { value: "this-month", label: "This month" },
];

type Props = {
  causes: string[];
};

/**
 * URL-driven filter chips for /discover. The active state lives in
 * `?kind=...&time=...&cause=...` so links stay shareable and reloads
 * preserve the filter.
 */
export function DiscoverFilters({ causes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = params.get("kind") ?? "all";
  const time = params.get("time") ?? "any";
  const cause = params.get("cause") ?? "all";

  const setParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterGroup
        label="Type"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(v) => setParam("kind", v, "all")}
      />
      <FilterGroup
        label="When"
        options={TIME_OPTIONS}
        value={time}
        onChange={(v) => setParam("time", v, "any")}
      />
      <FilterGroup
        label="Cause"
        options={[{ value: "all", label: "All causes" }, ...causes.map((c) => ({ value: c, label: capitalize(c) }))]}
        value={cause}
        onChange={(v) => setParam("cause", v, "all")}
      />
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </span>
      <div className="flex items-center gap-px overflow-hidden rounded-full border border-hairline">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                "px-2.5 py-1 font-mono text-[11px] leading-none",
                active
                  ? "bg-[var(--accent-soft)] text-accent"
                  : "bg-paper text-ink-subtle hover:bg-mist",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
