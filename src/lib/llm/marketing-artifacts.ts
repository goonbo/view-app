import { z } from "zod";

/**
 * Shared system prompt for marketing-artifact generation. Voice rules from
 * <llm_prompts>: produce only the artifact text — no preamble, no
 * meta-commentary, no "here is your..." framing. Don't invent statistics
 * not in the recap. Quote partners only if quoted in the recap.
 */
export const MARKETING_BASE_SYSTEM = `You are generating marketing copy from an approved corporate CSR recap document. You produce ONE artifact at a time, each in a distinct voice for its channel.

You receive: the recap document content and the artifact kind. You produce only the artifact text — no preamble, no meta-commentary, no "here is your..." framing.

Use the data from the recap. Don't invent statistics; if a number isn't in the recap, don't add one. Quote partners only if quoted in the recap.`;

export type ArtifactKind =
  | "linkedin"
  | "newsletter"
  | "all_hands"
  | "social_short"
  | "csr_page";

export const ARTIFACT_KICKERS: Record<ArtifactKind, string> = {
  linkedin:
    "LinkedIn post. ~200 words. First sentence is the moment, not the meta-commentary. Tag the partner nonprofit. End with one stat. No emoji. No hashtag stuffing — one or two relevant hashtags maximum.",
  newsletter:
    "Internal employee newsletter blurb. ~100 words. Addressed to \"team.\" Name 2-3 specific employees by first name if they appear in the recap. Include one quoted line in italics. No exclamation marks.",
  all_hands:
    "All-hands slide bullets for a 60-second CEO mention. Output: one title line (one big stat or phrase, max 8 words) + 5-7 bullets. Each bullet ≤10 words. Concrete, scannable from the back row.",
  social_short:
    "Short social post, X-style. ≤280 chars total. One stat + one CTA. No hashtags. Mention the partner nonprofit by handle if available, else by name.",
  csr_page:
    "CSR website paragraph. ~120 words. Brand voice: practical, calm, named partners. Suitable for permanent placement on a \"Community\" section of the corporate website. Ends with the cause-area framing.",
};

export const ARTIFACT_LABEL: Record<ArtifactKind, string> = {
  linkedin: "LinkedIn post",
  newsletter: "Internal newsletter",
  all_hands: "All-hands bullets",
  social_short: "Social post",
  csr_page: "CSR page paragraph",
};

export const ArtifactSchema = z.object({
  content_md: z.string().min(20),
});
export type ArtifactPayload = z.infer<typeof ArtifactSchema>;

export function buildArtifactUserPrompt(opts: {
  kind: ArtifactKind;
  recapTitle: string;
  recapLede?: string | null;
  recapBody?: string | null;
  byTheNumbers?: Record<string, string | number>;
}): string {
  const lines = [
    `Artifact kind: ${opts.kind}`,
    `Recap title: ${opts.recapTitle}`,
    opts.recapLede ? `Lede: ${opts.recapLede}` : "",
    opts.byTheNumbers
      ? `By-the-numbers: ${Object.entries(opts.byTheNumbers)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      : "",
    opts.recapBody ? `Body excerpt:\n${truncate(opts.recapBody, 1200)}` : "",
    "",
    ARTIFACT_KICKERS[opts.kind],
    "",
    'Return only the JSON object: { "content_md": "<your text>" }. No prose, no markdown fence.',
  ];
  return lines.filter(Boolean).join("\n");
}

export function fixtureKeyForArtifact(recapId: string, kind: ArtifactKind): string {
  return `marketing-${kind}-${recapId}`;
}
export function fixtureFallbackKeyForArtifact(kind: ArtifactKind): string {
  return `marketing-${kind}-default`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
