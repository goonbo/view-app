import { redirect } from "next/navigation";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";

/**
 * Legacy nonprofit landing. The v2 build moves this surface to
 * `/np/workbench` (richer dashboard with ambient stats + pending
 * review). Nonprofit viewers bounce there; corporate viewers
 * (who would never reach here via the sidebar nav) get sent to
 * their workbench too.
 */
export default async function NonprofitHomeRedirectPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type === "nonprofit") redirect("/np/workbench");
  redirect("/workbench");
}
