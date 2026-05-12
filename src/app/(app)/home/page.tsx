import { redirect } from "next/navigation";
import { Placeholder } from "@/components/shared/Placeholder";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";

export default async function NonprofitHomePage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/workbench");

  return (
    <Placeholder
      phase="Phase 3"
      title={`Hi ${ws.primaryUser.firstName}`}
      description="Your CRM-shaped workspace for creating events, running donation campaigns, managing rosters, and tracking corporate partner relationships."
    />
  );
}
