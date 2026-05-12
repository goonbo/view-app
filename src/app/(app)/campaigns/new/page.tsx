import { redirect } from "next/navigation";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { CampaignDraftForm } from "@/components/campaigns/CampaignDraftForm";

export default async function NewCampaignPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/campaigns");

  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[820px] py-2">
      <EyebrowLabel className="mb-2">PUBLISH A CAMPAIGN</EyebrowLabel>
      <h1 className="font-sans text-[22px] font-medium leading-[1.2] tracking-tight text-ink">
        Run a donation drive
      </h1>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.6] text-ink-subtle">
        One sentence is fine. Claude drafts a publishable campaign — title,
        story, suggested goal, and a four-tier giving ladder. You edit, then
        approve to publish to your corporate partners&rsquo; Discover feed.
      </p>
      <div className="mt-8">
        <CampaignDraftForm defaultStart={start} defaultEnd={end} />
      </div>
    </div>
  );
}
