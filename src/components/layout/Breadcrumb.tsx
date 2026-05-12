"use client";

import { usePathname } from "next/navigation";

function deriveBreadcrumb(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  const root = segments[0];
  const labels: Record<string, string> = {
    workbench: "Workbench",
    discover: "Discover",
    partners: "Partners",
    matching: "Matching",
    campaigns: "Campaigns",
    recaps: "Recaps",
    events: "Events",
    volunteers: "Volunteers",
    home: "Home",
  };
  return labels[root] ?? root.charAt(0).toUpperCase() + root.slice(1);
}

export function Breadcrumb() {
  const pathname = usePathname();
  return (
    <span className="text-[13px] leading-none text-ink-subtle">
      {deriveBreadcrumb(pathname)}
    </span>
  );
}
