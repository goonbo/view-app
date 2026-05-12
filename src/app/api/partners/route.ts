import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { diligenceDocuments, nonprofitPartners } from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { propublica } from "@/lib/propublica";

export const runtime = "nodejs";

type Body = {
  ein: string;
  legal_name?: string;
  common_name?: string;
  city?: string;
  state?: string;
  ntee_classification?: string;
};

/**
 * Creates a new nonprofit_partner in the active corporate workspace, plus a
 * companion diligence_document in `generating` state. Returns the partner ID
 * so the client can navigate to /partners/{id}/diligence and the SSE stream
 * picks it up from there.
 *
 * Idempotent on (corporate_workspace_id, ein): re-clicking "Begin diligence"
 * for the same EIN returns the existing partner instead of duplicating.
 */
export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }

  const body = (await req.json()) as Body;
  const ein = body.ein.replace(/-/g, "");

  // If a partner with this EIN already exists in this workspace, return it.
  const existing = await db
    .select()
    .from(nonprofitPartners)
    .where(
      and(
        eq(nonprofitPartners.corporateWorkspaceId, ws.id),
        eq(nonprofitPartners.ein, ein),
      ),
    )
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ partnerId: existing[0].id, reused: true });
  }

  // Pull a richer set of fields directly from ProPublica so the partner row
  // has location/mission/website without depending on the search payload.
  let legalName = body.legal_name ?? "Unknown organization";
  let commonName = body.common_name ?? legalName;
  let location: string | null =
    body.city && body.state ? `${body.city}, ${body.state}` : null;
  let website: string | null = null;
  let mission: string | null = null;

  try {
    const org = await propublica.getOrganization(ein);
    legalName = org.legal_name;
    commonName = org.common_name || org.legal_name;
    location = [org.city, org.state].filter(Boolean).join(", ") || location;
    website = org.website || null;
    mission = org.mission || null;
  } catch {
    // Search-only metadata is enough to create the partner row.
  }

  const [partner] = await db
    .insert(nonprofitPartners)
    .values({
      corporateWorkspaceId: ws.id,
      ein,
      legalName,
      commonName,
      mission,
      location,
      website,
      causeAreas: [],
      status: "in_diligence",
      matchEligible: false,
    })
    .returning();

  await db.insert(diligenceDocuments).values({
    partnerId: partner.id,
    workspaceId: ws.id,
    ein,
    status: "generating",
    signals: {},
    thingsToVerify: [],
  });

  return NextResponse.json({ partnerId: partner.id, reused: false });
}
