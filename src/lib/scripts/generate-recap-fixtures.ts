/**
 * Generates LLM fixtures for Phase 6:
 *   - One streaming recap (default fallback) — hand-written in
 *     Stripe-quarterly voice, tokenized with realistic cadence
 *   - One structured tail (by-the-numbers + outcomes + recommendations)
 *   - Five marketing artifacts (default fallbacks)
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const NARRATIVE = `Twenty-two of our team spent a Saturday morning at Central Texas Food Bank's mobile pantry, and the quarter quietly took shape from there. We served 410 families that morning, and the operational craft of the GAFB warehouse crew set a bar our employees noticed and asked to repeat. The dual story is that the food bank now treats Acme as one of their reliable Saturday partners — and that we delivered measurable corporate volunteer hours without burning anyone out.

## By the numbers

Sixty-six volunteer hours. Twenty-two employees on-site. Four hundred and ten families served. Three no-shows out of twenty-five registrations, which is the honest cost of any volunteer event but inside the band we'd plan for.

## What worked

The Friday pre-sort paid for itself. Setup time dropped by 35 minutes on Saturday, which sounds small until you watch a thirty-person crew stand around with nothing to do. Marcus's logistics email three days out drove 88% confirmation — measurably above our prior quarter's 73%. And the unplanned bright spot: Janelle and Reza, the two engineering interns who'd never volunteered before, were running the produce table independently 30 minutes in. The Saturday crew said yes when we asked if they'd come back.

## What drifted

We over-ordered cardboard boxes for repacking and shipped 40 unused boxes back to the warehouse. Our model was headcount × 2; the prior three events suggest 1.2× consumption. We'll change the order template. Separately: one volunteer had to switch roles mid-event because the warehouse-to-staging route isn't wheelchair-friendly. We didn't ask on the registration form. That's a fix for next quarter.

The honest version of "what drifted" is short — most of the friction was in our planning, not in our execution. That's a reasonable position to be in.`;

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
    const burst = pickBurst();
    grouped.push(tokens.slice(i, i + burst).join(""));
    i += burst;
  }
  return grouped.map((delta, idx) => {
    let delay = 50 + Math.floor(Math.random() * 60);
    if (/[.!?]\s*$/.test(delta)) delay += 80 + Math.floor(Math.random() * 160);
    if (idx === 0) delay = 380 + Math.floor(Math.random() * 200);
    return { delta, delayMs: delay };
  });
}

function pickBurst(): number {
  const r = Math.random();
  if (r < 0.5) return 1;
  if (r < 0.85) return 2;
  return 3;
}

const STRUCTURED = {
  by_the_numbers: {
    hours: 66,
    volunteers: 22,
    families_served: 410,
    no_shows: 3,
    pre_sort_minutes_saved: 35,
  },
  outcomes: [
    {
      headline: "Drive-through pacing held under 8 minutes",
      body: "Client wait stayed under 8 minutes after the first half hour. The pre-event sort meaningfully reduced setup time and is worth keeping as a standing procedure.",
    },
    {
      headline: "Two interns ran the produce table unsupervised",
      body: "Engineering interns Janelle and Reza paired with regular Saturday volunteers and were running the table independently within 30 minutes. A low-friction onboarding pattern worth modeling for new hires.",
    },
    {
      headline: "Mobility access is not solved",
      body: "One volunteer had to switch roles mid-event because the warehouse-to-staging route isn't wheelchair-friendly. We didn't ask on the registration form, which is a fix for next quarter.",
    },
  ],
  recommendations: [
    {
      headline: "Add mobility question to registration",
      body: "A single line on the form would have surfaced the issue before Saturday morning and given us time to plan around it. Add to the standard event template now.",
    },
    {
      headline: "Order supplies against prior-event consumption, not headcount",
      body: "We ordered for headcount × 2 and shipped 40 unused boxes back to the warehouse. Past three events suggest 1.2× consumption is the right multiplier; update the order template.",
    },
    {
      headline: "Repeat the Friday pre-sort",
      body: "It cut Saturday setup by 35 minutes and paid for itself in volunteer hours saved. Make it a standing operating procedure for any warehouse-side event.",
    },
  ],
};

const ARTIFACTS = {
  linkedin: {
    content_md:
      "Last Saturday, 22 of our team spent the morning at Central Texas Food Bank's mobile pantry. We unloaded pallets, sorted produce, and helped 410 families take home a week of groceries. Drive-through pacing stayed under 8 minutes after the first half hour — credit to Maria Velasquez and the CTFB team for the operational craft.\n\nA Friday pre-sort cut our Saturday setup by 35 minutes. Two engineering interns paired with regular volunteers and were running the produce table on their own within half an hour. The Saturday crew said yes when we asked if they'd come back.\n\nThis is our second quarter of partnering with CTFB. If you want to volunteer with us, ping Marcus.\n\n410 families. One Saturday morning. #foodsecurity",
  },
  newsletter: {
    content_md:
      "Team — last Saturday 22 of you showed up at Central Texas Food Bank's mobile pantry and helped serve 410 families. Special thanks to Janelle and Reza for jumping into the produce table on day one — half an hour in they were running it themselves. As Maria from CTFB put it: *\"You all moved faster than my regular Saturday crew, which is saying something.\"* The Friday pre-sort idea worked; we'll keep it. Q2 warehouse sort is on the calendar — April 18, signups open Monday. Reply if you want a spot. — Maya",
  },
  all_hands: {
    content_md:
      "410 FAMILIES IN A SATURDAY\n\n- 22 Acme employees on-site at CTFB mobile pantry\n- 66 volunteer hours logged\n- Sub-8-minute drive-through wait after the first half hour\n- Two engineering interns ran the produce table\n- Friday pre-sort cut setup by 35 minutes\n- Q2 warehouse sort: April 18, signups open Monday",
  },
  social_short: {
    content_md:
      "22 of our team. 66 hours. 410 families served at Central Texas Food Bank's mobile pantry last Saturday. Q2 sort on April 18 — DM Marcus to join.",
  },
  csr_page: {
    content_md:
      "Our community partnership with Central Texas Food Bank brought 22 Acme team members to their mobile pantry distribution this quarter. Together, we helped serve 410 families across southeast Austin — 66 hours of work, one Saturday morning. The food bank operates at a 96% deployment ratio and serves Central Texas year-round. Our matching gift program covers employee donations to CTFB at 1:1 through the end of the year, and our quarterly warehouse sort is a standing operating commitment. Food security is one of three causes Acme commits to as a company.",
  },
};

async function writeJson(rel: string, value: unknown) {
  const full = path.join(process.cwd(), "src", "lib", "fixtures", rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(value, null, 2));
}

async function main() {
  const chunks = buildChunks(NARRATIVE);
  const total = chunks.reduce((s, c) => s + c.delayMs, 0);
  await writeJson("llm/recap-default.json", { totalDurationMs: total, chunks });
  await writeJson("llm/recap-structured-default.json", STRUCTURED);
  for (const [kind, payload] of Object.entries(ARTIFACTS)) {
    await writeJson(`llm/marketing-${kind}-default.json`, payload);
  }
  console.log(
    `✓ Wrote 1 recap stream (${chunks.length} chunks / ${(total / 1000).toFixed(1)}s), 1 structured tail, 5 artifact fixtures.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
