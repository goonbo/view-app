import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { nonprofitPartners } from "@/db/schema";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";
import { EyebrowLabel } from "@/components/shared/EyebrowLabel";
import { MatchPolicyForm } from "@/components/matching/MatchPolicyForm";

export default async function NewMatchPolicyPage() {
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const partners = await db
    .select({
      id: nonprofitPartners.id,
      commonName: nonprofitPartners.commonName,
      ein: nonprofitPartners.ein,
      matchEligible: nonprofitPartners.matchEligible,
    })
    .from(nonprofitPartners)
    .where(
      and(
        eq(nonprofitPartners.corporateWorkspaceId, ws.id),
        eq(nonprofitPartners.status, "vetted"),
      ),
    );

  const now = new Date();
  const year = now.getFullYear();
  const start = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const end = `${year + 1}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-[720px] py-2">
      <EyebrowLabel className="mb-2">CREATE A MATCH POLICY</EyebrowLabel>
      <h1 className="font-sans text-[22px] font-medium leading-[1.2] tracking-tight text-ink">
        Match donations from your team
      </h1>
      <p className="mt-2 max-w-[58ch] text-[14px] leading-[1.6] text-ink-subtle">
        Pick which vetted partners are eligible, set a ratio, and define
        caps. Donations to eligible partners during the window will match
        automatically — no manual approval per donation.
      </p>
      <div className="mt-8">
        <MatchPolicyForm partners={partners} defaultStart={start} defaultEnd={end} />
      </div>
    </div>
  );
}
