import { redirect } from "next/navigation";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { PartnerSearch } from "@/components/partners/PartnerSearch";

export default async function NewPartnerPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");
  return (
    <div className="mx-auto max-w-[720px] py-2">
      <EyebrowLabel className="mb-2">VET A NEW PARTNER</EyebrowLabel>
      <h1 className="font-sans text-[20px] font-medium leading-[1.3] tracking-tight text-ink">
        Find an organization
      </h1>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.6] text-ink-subtle">
        Search ProPublica&rsquo;s Nonprofit Explorer to find an org and begin
        diligence. Claude reads IRS Form 990 data and writes a calm
        partnership read against {ws.name}&rsquo;s {ws.causeAreas[0] ?? "education"} focus.
      </p>
      <div className="mt-8">
        <PartnerSearch />
      </div>
    </div>
  );
}
