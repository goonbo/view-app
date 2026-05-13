import { z } from "zod";

/**
 * System prompt for the nonprofit-side quarterly impact recap.
 * Voice from view-nonprofit-side-build-prompt.md:
 *   gratitude-led, mission-anchored, named-volunteers-as-individuals,
 *   converts hours to outcome-equivalents (homes built, families served),
 *   ties the quarter to a forward-looking moment.
 *
 * Explicit anti-patterns: avoid the corporate voice. No metrics-as-trophies.
 * No "engagement" language. No KPIs.
 */
export const NONPROFIT_RECAP_SYSTEM = `You are writing a quarterly impact recap for a nonprofit. The reader is a donor or board member. The voice is a letter from the executive director — gratitude-led, mission-anchored, specific.

Structure:
1. Opening paragraph — the quarter in one paragraph. Lead with gratitude, name the partners, hint at the mission moment.
2. Partner contributions — one paragraph per corporate partner. Name 3-5 specific volunteers per paragraph. Tie hours to outcome equivalents (homes built, families served, meals distributed).
3. What worked — 2 paragraphs. Operational AND human. What landed; what people said.
4. What drifted — 1 paragraph, honest. Don't gloss past problems. Name the cause and what you'll do.
5. The ask for next quarter — specific volunteer needs, not vague platitudes.

Forbidden phrases: "engagement", "make a difference", "impact" (as a noun), "amazing", "incredible", "leveraging", "going forward".

Required moves: name specific volunteers; thank specifically rather than generically; convert hours to outcome equivalents at least once; tie the quarter to a forward-looking mission moment in the closing.`;

export const NonprofitRecapStructuredSchema = z.object({
  partner_contributions: z
    .array(
      z.object({
        partner_workspace_id: z.string(),
        partner_name: z.string(),
        paragraph: z.string().min(40),
        named_volunteers: z.array(z.string()).min(2).max(6),
      }),
    )
    .min(1)
    .max(5),
  what_worked: z.string().min(80),
  what_drifted: z.string().min(40),
  ask_for_next_quarter: z.string().min(40),
});

export type NonprofitRecapStructured = z.infer<
  typeof NonprofitRecapStructuredSchema
>;

export const NONPROFIT_RECAP_STRUCTURED_INSTRUCTION = `From the same period of activity, output exactly:
- partner_contributions: one entry per corporate partner. Each entry has partner_workspace_id, partner_name, a 3-5 sentence paragraph that names 3-5 specific volunteers and ties hours to outcome equivalents, and named_volunteers (an array of those names).
- what_worked: 2 paragraphs as one string.
- what_drifted: 1 honest paragraph.
- ask_for_next_quarter: specific asks for volunteers in the next quarter.

Return only the JSON object that matches the schema. No prose, no markdown fence.`;

export function buildNonprofitRecapUserPrompt(opts: {
  nonprofitName: string;
  period: string;
  partners: Array<{
    workspaceId: string;
    name: string;
    volunteerCount: number;
    hours: number;
    namedVolunteers: { name: string; hours: number; tags: string[] }[];
  }>;
  totalHours: number;
  totalVolunteers: number;
  eventCount: number;
  outcomeEquivalent: string;
}): string {
  const lines = [
    `Nonprofit: ${opts.nonprofitName}`,
    `Period: ${opts.period}`,
    `Totals: ${opts.totalHours} volunteer hours, ${opts.totalVolunteers} volunteers, ${opts.eventCount} events`,
    `Outcome equivalent for ${opts.totalHours} hours: ${opts.outcomeEquivalent}`,
    "",
    "Partner activity:",
    ...opts.partners.map((p) => {
      const named = p.namedVolunteers
        .map((v) => `${v.name} (${v.hours}h, ${v.tags.join(", ")})`)
        .join("; ");
      return `- ${p.name} [id ${p.workspaceId}]: ${p.volunteerCount} volunteers, ${p.hours} hours. Notable: ${named}`;
    }),
    "",
    "Write the nonprofit-voiced quarterly impact recap. Lead with gratitude, name specific volunteers, end with the ask for next quarter.",
  ];
  return lines.filter(Boolean).join("\n");
}

export function fixtureKeyForNonprofitRecap(recapId: string): string {
  return `np-recap-narrative-${recapId}`;
}
export function fixtureKeyForNonprofitRecapStructured(recapId: string): string {
  return `np-recap-structured-${recapId}`;
}
