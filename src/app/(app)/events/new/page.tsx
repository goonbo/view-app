import { redirect } from "next/navigation";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { EventDraftForm } from "@/components/events/EventDraftForm";

export default async function NewEventPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "nonprofit") redirect("/discover");

  const twoWeeksOut = new Date(Date.now() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-[820px] py-2">
      <EyebrowLabel className="mb-2">PUBLISH AN EVENT</EyebrowLabel>
      <h1 className="font-sans text-[22px] font-medium leading-[1.2] tracking-tight text-ink">
        Describe the event you want to run
      </h1>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.6] text-ink-subtle">
        One sentence is fine. Claude drafts a publishable brief — title,
        description, capacity, agenda, supplies. You edit anything you want,
        then approve to publish to your corporate partners&rsquo; Discover
        feed.
      </p>
      <div className="mt-8">
        <EventDraftForm defaultDate={twoWeeksOut} />
      </div>
    </div>
  );
}
