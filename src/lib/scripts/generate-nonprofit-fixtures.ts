/**
 * Generates hand-crafted LLM fixtures for the nonprofit-side v2 build:
 *   - Streaming recap narrative (default) in nonprofit voice
 *   - Structured recap tail (partner contributions, what worked,
 *     what drifted, the ask)
 *   - Four marketing artifact defaults (donor_newsletter, grant_snippet,
 *     board_update, social_thanks)
 *
 * Run once: `npx tsx src/lib/scripts/generate-nonprofit-fixtures.ts`
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const OPENING = `A note from Habitat for Humanity GSF.

Habitat for Humanity Greater SF closed Q3 with 1,124 volunteer hours from three corporate partners — Acme Robotics, Lumen Industries, and Boldfish Co. Forty-seven people built homes, sorted warehouses, and stocked pantries together. These hours funded the equivalent of 1.4 family home builds. We are closer to opening the East Side site because of this — and that is the thing we want to hold up to the light first.`;

const PARTNER_PARAGRAPHS = [
  {
    partner_workspace_id: "61636d65-0000-4000-8000-000000000c40",
    partner_name: "Acme Robotics",
    paragraph: `From Acme, Maya Chen led on the build days and back at the warehouse — 38 hours across seven events, and the kind of attendance that makes a Saturday crew predictable. Hannah Lee was at every quarterly sort with her own gloves. Janelle Ortiz and Reza Naderi joined as first-time interns and were running the produce table within thirty minutes; we asked them back. Across Acme's group, 24 volunteers contributed 686 hours, roughly the equivalent of one family home's framing week.`,
    named_volunteers: ["Maya Chen", "Hannah Lee", "Janelle Ortiz", "Reza Naderi"],
  },
  {
    partner_workspace_id: "6c756d65-0000-4000-8000-000000000c40",
    partner_name: "Lumen Industries",
    paragraph: `From Lumen, Priya Subbu interpreted in Spanish at every Build Day she attended this quarter, which mattered more than the hours count alone — three of our incoming families speak Spanish at home, and the Build Day she ran in February was the first time a build crew met them in their language. Carla Mendes brought her kitchen-trained crew to the Holiday Volunteer Drive. Yusuf Al-Hassan ran a forklift through two warehouse sorts. Lumen contributed 286 hours.`,
    named_volunteers: ["Priya Subbu", "Carla Mendes", "Yusuf Al-Hassan"],
  },
  {
    partner_workspace_id: "626f6c64-0000-4000-8000-000000000c40",
    partner_name: "Boldfish Co.",
    paragraph: `Boldfish came in late and small — Jamie Okafor signed up the team in October and they led their first MLK Day Service event in January. Devon Rhodes has been to two builds. Yara Hadid joined for the family-friendly build in March and brought her kids; it was the first multi-generational build crew we've hosted. Boldfish contributed 152 hours, all in the second half of the quarter, and we expect them to scale up in Q4.`,
    named_volunteers: ["Jamie Okafor", "Devon Rhodes", "Yara Hadid"],
  },
];

const WHAT_WORKED = `The most operational win was the cross-partner build day in February. Sixteen volunteers came from Acme and Lumen together — different employers in the same crew, different skill mixes that complemented each other. Maya Chen and Carla Mendes co-ran the kitchen side. Nobody noticed the seam.

Humanly: the family-friendly build in March. We've never run one before; Boldfish suggested it. Ten adults, six kids, three hours, lower-stakes tasks. The kids asked when we were coming back. That's the quote we kept.`;

const WHAT_DRIFTED = `Q1 Warehouse Sort underperformed. Forty-two signed up, 24 checked in, 18 no-shows — eleven of those eighteen were from Acme Engineering, who'd booked a team offsite on the same day. We didn't catch it in advance. The fix is calendar-side: we'll ask Acme's People Ops to share their offsite schedule with us a quarter out. It's a fixable problem; we want to flag it rather than rationalize it.`;

const ASK = `For Q4, we need: ten Spanish-speaking volunteers for the East Side family welcome on October 15 (Priya Subbu has offered to coordinate); a forklift-certified crew of six for the December warehouse turnover; and one corporate partner willing to sponsor the kids' summer program kickoff in November. The kickoff is our highest-leverage event of the year — last year's underwriter has moved on, and we'd love to find the next one before October ends.`;

// ─────────────────────────────────────────────────────────────────────
// Tokenize the narrative for streaming with realistic cadence.

function tokenize(text: string): string[] {
  const chunks: string[] = [];
  const re = /(\s+\S+|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) chunks.push(m[1]);
  return chunks;
}

function buildChunks(text: string): { delta: string; delayMs: number }[] {
  const tokens = tokenize(text);
  const grouped: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const burst = 1 + (Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2);
    grouped.push(tokens.slice(i, i + burst).join(""));
    i += burst;
  }
  return grouped.map((delta, idx) => {
    let delay = 50 + Math.floor(Math.random() * 60);
    if (/[.!?]\s*$/.test(delta)) delay += 100 + Math.floor(Math.random() * 180);
    if (idx === 0) delay = 380 + Math.floor(Math.random() * 200);
    return { delta, delayMs: delay };
  });
}

// ─────────────────────────────────────────────────────────────────────
// Artifacts — each in its sub-voice.

const ARTIFACTS: Record<string, { body: string }> = {
  donor_newsletter: {
    body: `Dear friend,

This quarter we counted 1,124 volunteer hours across three corporate partners — Acme Robotics, Lumen Industries, and Boldfish Co. — and the line we keep coming back to was a quieter one. In February, Priya Subbu from Lumen interpreted in Spanish at every Build Day she attended. Three of our incoming families speak Spanish at home, and the Build Day she ran was the first time a build crew met them in their language. It wasn't the most hours of the quarter. It was the moment of the quarter.

We're closer to opening the East Side site because of this work — 1.4 family homes' worth of labor, real walls going up in a real neighborhood. Forty-seven people made that possible. We owe you the gratitude that should sit next to their names.

For Q4, we're looking for Spanish-speaking volunteers for our East Side family welcome on October 15. If you can spare a Saturday, Lina will get you in touch with Priya.`,
  },
  grant_snippet: {
    body: `In Q3 2026, Habitat for Humanity Greater SF mobilized 47 volunteers from three corporate partners — Acme Robotics, Lumen Industries, and Boldfish Co. — across 12 events, producing 1,124 documented volunteer hours. These hours represent the labor equivalent of 1.4 single-family home builds. Outcomes included a fully-framed East Side build site, two completed mobile pantry distributions serving 412 families, and the launch of a cross-partner build cohort that combined skills across employer cohorts for the first time. Q4 priorities include scaled multilingual outreach (October 15 family welcome) and a sponsored kids' summer program kickoff. Detailed event-level data and volunteer rosters available upon request.`,
  },
  board_update: {
    body: `Q3 highlights for board review:

— 1,124 volunteer hours across 12 events, three corporate partners. Equivalent to ~1.4 family home builds.

— First cross-partner build day in February (Acme + Lumen). Sixteen volunteers, no operational seam. Worth repeating.

— First family-friendly build in March (Boldfish). Ten adults, six kids, three hours. Kids asked to come back.

— One operational miss: Q1 Warehouse Sort had 18 no-shows of 42 signups; 11 from a single Acme team that had an offsite conflict. Fix is calendar-sharing with their People Ops, scheduled for August.

Q4 needs from the board: introductions to potential sponsors for the kids' summer program kickoff (November). Last year's underwriter has moved on. We're prioritizing this conversation over the next six weeks.`,
  },
  social_thanks: {
    body: `Forty-seven volunteers. Three partners. 1,124 hours of work in Q3. Special thanks to Priya, Maya, and Carla — you carried the build days. The East Side site is closer to a family home because you showed up. 🏠`,
  },
};

// ─────────────────────────────────────────────────────────────────────

async function writeJson(rel: string, value: unknown) {
  const full = path.join(process.cwd(), "src", "lib", "fixtures", rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(value, null, 2));
}

async function main() {
  // Recap narrative — built as the concatenated opening + what-worked +
  // what-drifted + ask, in streaming order. The structured tail contains
  // the per-partner paragraphs (rendered separately on the page).
  const narrative = [
    OPENING,
    "",
    "What worked.",
    "",
    WHAT_WORKED,
    "",
    "What drifted.",
    "",
    WHAT_DRIFTED,
    "",
    "The ask for next quarter.",
    "",
    ASK,
  ].join("\n");
  const chunks = buildChunks(narrative);
  const totalMs = chunks.reduce((s, c) => s + c.delayMs, 0);

  await writeJson("llm/np-recap-narrative-default.json", {
    totalDurationMs: totalMs,
    chunks,
  });

  await writeJson("llm/np-recap-structured-default.json", {
    partner_contributions: PARTNER_PARAGRAPHS,
    what_worked: WHAT_WORKED,
    what_drifted: WHAT_DRIFTED,
    ask_for_next_quarter: ASK,
  });

  for (const [kind, payload] of Object.entries(ARTIFACTS)) {
    await writeJson(`llm/np-artifact-${kind}-default.json`, payload);
  }

  console.log(
    `✓ Wrote nonprofit fixtures: narrative (${chunks.length} chunks / ${(totalMs / 1000).toFixed(1)}s), structured tail, ${Object.keys(ARTIFACTS).length} artifacts.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
