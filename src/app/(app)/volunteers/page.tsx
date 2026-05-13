import { redirect } from "next/navigation";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";

/**
 * Legacy /volunteers placeholder. The v2 build ships the real volunteer
 * CRM at `/np/volunteers` for nonprofit viewers; corporate viewers don't
 * have a volunteers surface yet, so they bounce home.
 */
export default async function VolunteersRedirectPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type === "nonprofit") redirect("/np/volunteers");
  redirect("/workbench");
}
