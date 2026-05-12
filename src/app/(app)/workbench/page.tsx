import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { WorkbenchClient } from "@/components/workbench/WorkbenchClient";
import type { WorkbenchFeed } from "@/app/api/workbench/feed/route";

/**
 * Server-renders an initial workbench feed by calling our own API route.
 * The client then polls every 4s on top. Doing the initial fetch
 * server-side avoids a flash of empty state on first paint.
 */
export default async function WorkbenchPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const reqHeaders = await headers();
  const host = reqHeaders.get("host") ?? "localhost:3000";
  const proto = reqHeaders.get("x-forwarded-proto") ?? "http";
  const cookieHeader = reqHeaders.get("cookie") ?? "";

  let initial: WorkbenchFeed | null = null;
  try {
    const res = await fetch(`${proto}://${host}/api/workbench/feed`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (res.ok) initial = (await res.json()) as WorkbenchFeed;
  } catch {
    // Fall through — client will retry via polling.
  }

  if (!initial) {
    initial = emptyFeed();
  }

  return <WorkbenchClient firstName={ws.primaryUser.firstName} initial={initial} />;
}

function emptyFeed(): WorkbenchFeed {
  return {
    ambient_stats: {
      quarter_hours: { value: 0, delta_label: "—" },
      matched_ytd: { value: 0, cap: null, delta_label: "—" },
      active_partners: { value: 0, delta_label: "—" },
    },
    pending_review: [],
    upcoming: [],
    active_campaigns: [],
    partner_activity: [],
    recently_shipped: null,
    next_event_summary: null,
  };
}
