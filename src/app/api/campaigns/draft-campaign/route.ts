import { NextResponse } from "next/server";
import { llm } from "@/lib/llm/adapter";
import {
  CAMPAIGN_DRAFT_FIXTURE_KEY,
  CAMPAIGN_DRAFT_SYSTEM,
  CampaignDraftSchema,
  buildCampaignDraftUserPrompt,
} from "@/lib/llm/campaign-draft";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";

type Body = { description: string };

export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "nonprofit") {
    return NextResponse.json({ error: "Nonprofit workspace required" }, { status: 403 });
  }
  const body = (await req.json()) as Body;
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  try {
    const draft = await llm.generateObject({
      fixtureKey: CAMPAIGN_DRAFT_FIXTURE_KEY,
      systemPrompt: CAMPAIGN_DRAFT_SYSTEM,
      userPrompt: buildCampaignDraftUserPrompt({
        nonprofitName: ws.name,
        causeAreas: ws.causeAreas,
        oneLiner: body.description,
      }),
      schema: CampaignDraftSchema,
    });
    return NextResponse.json({ draft });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
