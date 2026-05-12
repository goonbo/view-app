import { z } from "zod";

/**
 * System prompt for the nonprofit-side AI event drafter.
 * Voice from <llm_prompts> in view-build-prompt-v5.md:
 * practical, grounded, no exclamation marks, no "amazing opportunity" hype.
 */
export const EVENT_DRAFT_SYSTEM = `You are an assistant to a nonprofit volunteer coordinator drafting a new event. From a one-sentence description, you produce a complete, publishable event brief.

The brief must:
- Title: clear, descriptive, no marketing language
- Description: 2 paragraphs — what volunteers will do, why it matters
- Suggested capacity: a single number with a one-sentence reason (based on the description)
- Agenda: 4-5 timeline bullets covering the event window
- Supplies needed: 3-5 concrete items (tools, materials, sustenance)
- Two follow-up questions: things you'd want the coordinator to clarify before publishing

Tone: practical, grounded, no exclamation marks, no "amazing opportunity" language. Volunteers are adults; brief them accordingly.`;

export const EventDraftSchema = z.object({
  title: z.string().min(8),
  description: z.string().min(40),
  suggested_capacity: z.number().int().positive(),
  capacity_reasoning: z.string().min(8),
  suggested_agenda: z.array(z.string()).min(3).max(6),
  supplies_needed: z.array(z.string()).min(2).max(6),
  followup_questions: z.array(z.string()).min(2).max(3),
});

export type EventDraft = z.infer<typeof EventDraftSchema>;

/** Single deterministic fixture key — fixture mode returns one canned draft. */
export const EVENT_DRAFT_FIXTURE_KEY = "event-draft-default";

export function buildEventDraftUserPrompt(opts: {
  nonprofitName: string;
  causeAreas: string[];
  oneLiner: string;
}): string {
  return [
    `Nonprofit: ${opts.nonprofitName}`,
    opts.causeAreas.length
      ? `Cause areas: ${opts.causeAreas.join(", ")}`
      : "",
    "",
    "Coordinator's description:",
    opts.oneLiner,
    "",
    "Return only the JSON object that matches the schema. No prose, no markdown fence.",
  ]
    .filter(Boolean)
    .join("\n");
}
