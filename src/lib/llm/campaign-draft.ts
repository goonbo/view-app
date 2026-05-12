import { z } from "zod";

/**
 * System prompt for the nonprofit-side AI campaign drafter.
 * Voice from <llm_prompts>: specific, non-generic; no vague "change lives"
 * impact language; no specific outcome claims unprovable from the input;
 * no match-language (matching is the corporate side's promotional moment).
 */
export const CAMPAIGN_DRAFT_SYSTEM = `You are an assistant to a nonprofit fundraiser drafting a donation campaign. From a one-sentence description, you produce a complete campaign brief.

The brief must:
- Title: specific, non-generic
- Story: 2-3 paragraphs — what the money funds, who it helps, why now
- Suggested goal amount with one-sentence reasoning
- Giving ladder: 4 tiers, each with an amount and a one-line description of what that amount provides ("$50 provides 10 family meals")

Avoid:
- Vague impact language ("change lives", "make a difference")
- Specific outcome claims unprovable from the description ("will help 500 children")
- Match-language ("your gift doubled!") — matching is the corporate side's promotional moment, not the nonprofit's`;

export const CampaignDraftSchema = z.object({
  title: z.string().min(6),
  story: z.string().min(80),
  suggested_goal: z.number().positive(),
  goal_reasoning: z.string().min(10),
  giving_ladder: z
    .array(
      z.object({
        amount: z.number().positive(),
        description: z.string().min(6),
      }),
    )
    .min(3)
    .max(5),
});

export type CampaignDraft = z.infer<typeof CampaignDraftSchema>;

export const CAMPAIGN_DRAFT_FIXTURE_KEY = "campaign-draft-default";

export function buildCampaignDraftUserPrompt(opts: {
  nonprofitName: string;
  causeAreas: string[];
  oneLiner: string;
}): string {
  return [
    `Nonprofit: ${opts.nonprofitName}`,
    opts.causeAreas.length ? `Cause areas: ${opts.causeAreas.join(", ")}` : "",
    "",
    "Fundraiser's description:",
    opts.oneLiner,
    "",
    "Return only the JSON object that matches the schema. No prose, no markdown fence.",
  ]
    .filter(Boolean)
    .join("\n");
}
