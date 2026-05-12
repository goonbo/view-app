import { z } from "zod";

/**
 * System prompt for the diligence narrative + structured tail.
 * Voice and constraints come from <llm_prompts> in view-build-prompt-v5.md.
 */
export const DILIGENCE_SYSTEM = `You are a senior CSR diligence analyst at a 320-person company. You read nonprofit Form 990 data and write a calm, qualitative two-paragraph read for a colleague who has 5 minutes to decide whether to engage this nonprofit as a partner.

Your read must:
- Be specific to the corporate workspace's cause-area focus
- Mention concrete figures from the 990 (program expense ratio, YoY revenue trend, executive compensation context)
- Surface partnership-fit considerations, not just charity-quality considerations
- End with a clear posture: comfortable / cautious / decline

Do NOT:
- Score the nonprofit on a numeric scale
- Make claims you can't ground in the provided data
- Use phrases like "strong fit" or "great partner" — those are conclusions, not analysis
- Write more than 5 sentences total.`;

export const DiligenceStructuredSchema = z.object({
  concern_level: z.enum(["low", "medium", "high"]),
  things_to_verify: z
    .array(z.string())
    .min(3)
    .max(3)
    .describe("Exactly three single-sentence items, each saying what to verify and why it matters."),
});

export type DiligenceStructured = z.infer<typeof DiligenceStructuredSchema>;

export const DILIGENCE_STRUCTURED_INSTRUCTION = `From the same Form 990 and narrative context, output exactly:
- concern_level: "low" | "medium" | "high"
- things_to_verify: exactly 3 single-sentence items. Each item names ONE thing to verify and why it matters before partnering.

Return only the JSON object that matches the schema. No prose, no markdown fence.`;

/** Build the user prompt for the streaming narrative. */
export function buildDiligenceUserPrompt(opts: {
  org: {
    legal_name: string;
    common_name?: string;
    ein: string;
    address?: string;
    city?: string;
    state?: string;
    ntee_classification?: string;
    ruling_date?: string;
    mission?: string;
    total_assets?: number;
  };
  filings: Array<{
    tax_period: number;
    total_revenue: number;
    total_expenses: number;
    program_service_revenue: number;
    executive_comp?: number;
    total_assets: number;
  }>;
  charityNavigator?: {
    overall_score: number;
    star_rating: number;
    advisories: string[];
  } | null;
  corporateWorkspaceName: string;
  primaryCauseArea: string;
}): string {
  const { org, filings, charityNavigator, corporateWorkspaceName, primaryCauseArea } = opts;
  const latest = filings[0];
  const prev = filings[1];
  const yoy = prev
    ? ((latest.total_revenue - prev.total_revenue) / prev.total_revenue) * 100
    : null;
  const lines = [
    `Read this nonprofit for ${corporateWorkspaceName}'s ${primaryCauseArea} focus.`,
    "",
    `Organization: ${org.common_name || org.legal_name} (legal: ${org.legal_name})`,
    `EIN: ${org.ein}`,
    org.city && org.state ? `Location: ${org.city}, ${org.state}` : "",
    org.ntee_classification ? `NTEE classification: ${org.ntee_classification}` : "",
    org.ruling_date ? `IRS ruling date: ${org.ruling_date}` : "",
    org.mission ? `Mission: ${org.mission}` : "",
    "",
    `Latest Form 990 (FY${latest.tax_period}):`,
    `- Total revenue: $${(latest.total_revenue / 1e6).toFixed(1)}M`,
    `- Total expenses: $${(latest.total_expenses / 1e6).toFixed(1)}M`,
    `- Program service revenue: $${(latest.program_service_revenue / 1e6).toFixed(1)}M`,
    latest.executive_comp
      ? `- Senior officer compensation: $${(latest.executive_comp / 1e3).toFixed(0)}K`
      : "",
    `- Total assets: $${(latest.total_assets / 1e6).toFixed(1)}M`,
    yoy !== null ? `- YoY revenue change: ${yoy >= 0 ? "+" : ""}${yoy.toFixed(1)}%` : "",
  ];
  if (charityNavigator) {
    lines.push("");
    lines.push(`Charity Navigator: ${charityNavigator.star_rating}★ (overall score ${charityNavigator.overall_score}/100)`);
    if (charityNavigator.advisories.length) {
      lines.push(`Advisories: ${charityNavigator.advisories.join("; ")}`);
    }
  }
  lines.push("");
  lines.push(`Write 3-5 sentences. Voice: calm, specific, partnership-focused. End with comfortable / cautious / decline.`);
  return lines.filter(Boolean).join("\n");
}

export function fixtureKeyForNarrative(ein: string): string {
  return `diligence-narrative-${ein.replace(/-/g, "")}`;
}

export function fixtureKeyForStructured(ein: string): string {
  return `diligence-structured-${ein.replace(/-/g, "")}`;
}
