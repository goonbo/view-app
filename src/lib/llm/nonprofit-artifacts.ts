import { z } from "zod";

/**
 * Marketing artifacts derived from a nonprofit recap.
 * Voice rules: gratitude/mission, not engagement metrics.
 */
export const NONPROFIT_ARTIFACT_SYSTEM = `You are generating outreach copy from an approved nonprofit quarterly impact recap. You produce ONE artifact at a time, each in a distinct voice for its channel.

The voice across all four artifacts is gratitude-led, mission-anchored, named-volunteers when present. Don't use corporate engagement language. Quote from the recap when you can; don't invent.

Output only the artifact text — no preamble, no meta-commentary.`;

export type NonprofitArtifactKind =
  | "donor_newsletter"
  | "grant_snippet"
  | "board_update"
  | "social_thanks";

export const NONPROFIT_ARTIFACT_KICKERS: Record<NonprofitArtifactKind, string> = {
  donor_newsletter:
    "Donor newsletter intro. ~3 paragraphs (~150 words total). Warm, personal, narrative. Lead with a moment from the quarter — a specific volunteer, a specific outcome. Mention the corporate partners by name. Close with the mission moment and a hint of what's next. Address the reader as you, not the team.",
  grant_snippet:
    "Grant application impact snippet. ~1 paragraph, ~100 words. Factual, board-ready, outcome-quantified. Less warmth than the newsletter — this is for a foundation officer reading 40 applications. Quantify: hours, events, families served, homes funded equivalent. Name the corporate partners by name but don't lead with them.",
  board_update:
    "Board update excerpt. Operational and forward-looking. ~120 words. What we did this quarter (briefly), what's next (specifically), what we need from the board to make next happen. Bullet-friendly but readable as prose.",
  social_thanks:
    "Short social thank-you post. ≤280 characters total. Names 2-3 volunteers by first name. Implies a photo (don't write [photo:] tags, just write copy that assumes one). Warm, specific, no hashtag stuffing — one mission-relevant hashtag at most.",
};

export const NONPROFIT_ARTIFACT_LABEL: Record<NonprofitArtifactKind, string> = {
  donor_newsletter: "Donor newsletter intro",
  grant_snippet: "Grant application snippet",
  board_update: "Board update excerpt",
  social_thanks: "Social thank-you post",
};

export const NonprofitArtifactSchema = z.object({
  body: z.string().min(20),
});
export type NonprofitArtifactPayload = z.infer<
  typeof NonprofitArtifactSchema
>;

export function buildNonprofitArtifactUserPrompt(opts: {
  kind: NonprofitArtifactKind;
  recapPeriod: string;
  openingPara: string | null;
  whatWorked: string | null;
  whatDrifted: string | null;
  askForNextQuarter: string | null;
  partnerContributions: {
    partner_name: string;
    paragraph: string;
    named_volunteers: string[];
  }[];
}): string {
  const lines = [
    `Artifact kind: ${opts.kind}`,
    `Recap period: ${opts.recapPeriod}`,
    opts.openingPara ? `Opening: ${opts.openingPara}` : "",
    opts.whatWorked ? `What worked: ${opts.whatWorked}` : "",
    opts.whatDrifted ? `What drifted: ${opts.whatDrifted}` : "",
    opts.askForNextQuarter ? `Ask for next quarter: ${opts.askForNextQuarter}` : "",
    "",
    "Partner contributions:",
    ...opts.partnerContributions.map(
      (p) =>
        `- ${p.partner_name}: ${p.paragraph}\n  Volunteers named: ${p.named_volunteers.join(", ")}`,
    ),
    "",
    NONPROFIT_ARTIFACT_KICKERS[opts.kind],
    "",
    'Return only the JSON object: { "body": "<your text>" }. No prose, no markdown fence.',
  ];
  return lines.filter(Boolean).join("\n");
}

export function fixtureKeyForNonprofitArtifact(
  recapId: string,
  kind: NonprofitArtifactKind,
): string {
  return `np-artifact-${kind}-${recapId}`;
}

export function fixtureFallbackKeyForNonprofitArtifact(
  kind: NonprofitArtifactKind,
): string {
  return `np-artifact-${kind}-default`;
}
