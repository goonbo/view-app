import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { diligenceDocuments, nonprofitPartners, users } from "@/db/schema";
import { DiligenceDocument, type DiligenceInitial } from "@/components/diligence/DiligenceDocument";
import { getActiveWorkspaceOrThrow } from "@/lib/active-workspace";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DiligencePage({ params }: Props) {
  const { id: partnerId } = await params;
  const ws = await getActiveWorkspaceOrThrow();
  if (ws.type !== "corporate") redirect("/home");

  const partnerRows = await db
    .select()
    .from(nonprofitPartners)
    .where(eq(nonprofitPartners.id, partnerId))
    .limit(1);
  const partner = partnerRows[0];
  if (!partner) notFound();

  const docRows = await db
    .select()
    .from(diligenceDocuments)
    .where(eq(diligenceDocuments.partnerId, partnerId))
    .limit(1);
  const doc = docRows[0];
  if (!doc) notFound();

  let approverName = ws.primaryUser.name;
  if (doc.approvedBy) {
    const approverRows = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, doc.approvedBy))
      .limit(1);
    approverName = approverRows[0]?.name ?? approverName;
  }

  const initial: DiligenceInitial = {
    diligenceId: doc.id,
    partnerId: partner.id,
    ein: partner.ein,
    corporateWorkspaceName: ws.name,
    primaryCauseArea: ws.causeAreas[0] ?? "education",
    approverName,
  };

  if (doc.status !== "generating") {
    initial.savedSnapshot = {
      status: doc.status as "ready_for_review" | "approved" | "rejected",
      narrative: doc.narrative ?? "",
      narrativeOriginal: doc.narrativeOriginal,
      things_to_verify: (doc.thingsToVerify as string[]) ?? [],
      concern_level: (doc.concernLevel as "low" | "medium" | "high") ?? "low",
      signals: (doc.signals ?? {
        verified_facts: { ein: partner.ein, legal_name: partner.legalName, common_name: partner.commonName },
        filing_summary: null,
      }) as NonNullable<DiligenceInitial["savedSnapshot"]>["signals"],
      approvedBy: doc.approvedBy,
      approvedAt: doc.approvedAt ? doc.approvedAt.toISOString() : null,
      editedAt: doc.editedAt ? doc.editedAt.toISOString() : null,
      rejectionReason: doc.rejectionReason,
    };
  }

  return <DiligenceDocument {...initial} />;
}
