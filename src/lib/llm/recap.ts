import { z } from "zod";

/**
 * System prompt for the corporate-side recap document.
 * Voice from <llm_prompts>: Stripe-style quarterly business review — calm,
 * specific, honest about what didn't work. The "What drifted" section is
 * the document's value; the forbidden phrases list is part of the brand.
 */
export const RECAP_SYSTEM = `You are writing a quarterly Community Recap document for a corporate CSR leader at a 320-person company. The reader is the CEO. The voice is Stripe's quarterly business review — calm, specific, honest about what didn't work.

Structure:
1. Lede paragraph (2-3 sentences, dual-value framing: business outcome + partner outcome)
2. By the numbers (presented as data, not crowed about)
3. What worked (3 short paragraphs, name specific events and partners)
4. What drifted (1-2 paragraphs — this section is non-negotiable; partial honesty is the document's value)
5. Three outcomes (each as a headline + 2-sentence body)
6. Three recommendations for next quarter (numbered, each with rationale)

Forbidden phrases: "going forward", "going to the next level", "impact", "making a difference", "incredible team", "amazing partners", "we're proud to".

Permitted moves: dry humor about logistical mishaps, named credit to specific people, concrete numbers in context, partner quotes when seeded data includes them.`;

export const RecapStructuredSchema = z.object({
  by_the_numbers: z.record(z.string(), z.union([z.number(), z.string()])),
  outcomes: z
    .array(
      z.object({
        headline: z.string().min(4),
        body: z.string().min(20),
      }),
    )
    .min(3)
    .max(3),
  recommendations: z
    .array(
      z.object({
        headline: z.string().min(4),
        body: z.string().min(20),
      }),
    )
    .min(3)
    .max(3),
});

export type RecapStructured = z.infer<typeof RecapStructuredSchema>;

export const RECAP_STRUCTURED_INSTRUCTION = `From the same period of activity, output exactly:
- by_the_numbers: a flat object of stat-name → number (or short string). Keys like "hours", "volunteers", "donations_matched".
- outcomes: exactly 3 items, each { headline, body }. Headline is one phrase, body is 2 sentences.
- recommendations: exactly 3 items, each { headline, body }. Headline is the action; body explains why.

Return only the JSON object that matches the schema. No prose, no markdown fence.`;

export function buildRecapUserPrompt(opts: {
  corporateWorkspaceName: string;
  scope: "event" | "campaign" | "quarterly";
  scopeTargetName?: string;
  periodStart: string;
  periodEnd: string;
  signupRows: Array<{ event: string; checked_in: number; capacity: number; hours: number }>;
  donationTotals: { count: number; raised: number; matched: number };
  partnerNames: string[];
}): string {
  const lines = [
    `Workspace: ${opts.corporateWorkspaceName}`,
    `Scope: ${opts.scope}${opts.scopeTargetName ? ` (${opts.scopeTargetName})` : ""}`,
    `Period: ${opts.periodStart} → ${opts.periodEnd}`,
    "",
    "Activity:",
    ...opts.signupRows.map(
      (r) =>
        `- ${r.event}: ${r.checked_in}/${r.capacity} checked in, ${r.hours} hours logged`,
    ),
    `- Donations: ${opts.donationTotals.count} gifts totaling $${opts.donationTotals.raised.toLocaleString()} (with $${opts.donationTotals.matched.toLocaleString()} in matches)`,
    `- Partners engaged: ${opts.partnerNames.join(", ")}`,
    "",
    "Write the recap document in Stripe-quarterly voice. Include all six sections from the system prompt.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function fixtureKeyForRecap(recapId: string): string {
  return `recap-${recapId}`;
}
export function fixtureKeyForRecapStructured(recapId: string): string {
  return `recap-structured-${recapId}`;
}
