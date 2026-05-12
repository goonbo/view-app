/**
 * Generates LLM streaming + structured fixtures for the 5 Phase 2 demo EINs
 * AND for the BGCA Austin in_diligence partner from the seed.
 *
 * Narratives are hand-written in the voice of a senior CSR diligence analyst,
 * anchored to the actual ProPublica numbers we just captured. This script
 * tokenizes each narrative into chunks with realistic streaming cadence
 * (~50-280ms per chunk, occasional pauses) and writes the JSON fixtures.
 *
 * Run once after `capture-propublica.ts`. Re-run when narratives change.
 *
 * Run with: npx tsx src/lib/scripts/generate-llm-fixtures.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";

type StructuredTail = {
  concern_level: "low" | "medium" | "high";
  things_to_verify: string[];
};

type Entry = {
  ein: string;
  narrative: string;
  tail: StructuredTail;
};

const ENTRIES: Entry[] = [
  // ─────────────────────────────────────────────────────────────
  // Central Texas Food Bank — large, stable, well-aligned w/ Acme
  {
    ein: "742217350",
    narrative:
      "Central Texas Food Bank operates at $116M in FY2023 revenue with $111M in expenses — a 96% deployment ratio that's standard for a food bank of this scale. Year-over-year revenue is up 1.7%, and total assets sit at $115M, suggesting they're not over-distributing reserves. Executive compensation is $765K, in band for a 200-plus FTE Texas org. The cause-area fit for Acme's food-security focus is direct, and they have a track record of corporate volunteer groups at the 30-50 employee scale. Comfortable to engage as a primary partner.",
    tail: {
      concern_level: "low",
      things_to_verify: [
        "Capacity for 30+ corporate volunteers on a single Saturday shift — confirm with Maria before activating.",
        "Whether their warehouse is wheelchair-accessible for employees with mobility needs.",
        "Whether the matching gift goes to general operations or restricted programs — ask before configuring the match policy.",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // American Red Cross — massive scale, well-known, predictable
  {
    ein: "530196605",
    narrative:
      "The American Red Cross is a $3.2B revenue org with $2.97B in expenses for FY2023 — financially predictable at this scale, with ~93% expense-to-revenue deployment. Year-over-year revenue grew 1.1%, well within normal range for a large public charity. Executive compensation of $5.9M for the senior officer cohort is in band relative to peer national nonprofits. The partnership-fit consideration here is scale: Red Cross volunteer programs tend to be highly templated and built for national corporate partners; expect less flexibility on event design but very high operational reliability. Comfortable.",
    tail: {
      concern_level: "low",
      things_to_verify: [
        "Whether they support corporate skills-based volunteering or only general blood drives and disaster response.",
        "Their minimum corporate partner commitment — many large nonprofits require multi-year sponsorship structures.",
        "Geographic chapter alignment — Acme's office concentration may matter for on-site events.",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Habitat for Humanity Greater San Francisco — strong YoY growth
  {
    ein: "943088881",
    narrative:
      "Habitat for Humanity Greater San Francisco shows $26.9M in FY2023 revenue against $31.5M in expenses — running a 17% deficit this year, partially offset by $13.8M in program service revenue from build-related earned income. Year-over-year revenue is up 23%, which is strong but worth scrutinizing for one-time large gifts versus sustainable growth. Executive compensation of $1.87M for the senior cohort is high relative to revenue base but typical for SF-area housing nonprofits. Workforce development fit for Acme's secondary cause area is good if you can route skills-based volunteers to build sites. Cautious — the deficit pattern warrants one more conversation before committing budget.",
    tail: {
      concern_level: "medium",
      things_to_verify: [
        "What drove the FY2023 deficit — capital project, one-time facilities expense, or structural?",
        "Whether the 23% YoY revenue growth came from earned program revenue (sustainable) or one-time grants.",
        "Their volunteer screening and tooling requirements — Habitat builds have insurance and training overhead.",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Feeding America — national network, strong growth, scale-y
  {
    ein: "363673599",
    narrative:
      "Feeding America is a $4.9B national network with $4.93B in FY2023 expenses — running essentially break-even at scale, which is normal for a passthrough food distribution org. Year-over-year revenue is up 15.2%, reflecting growth in food rescue partnerships post-pandemic. Program service revenue of $102M and executive compensation of $7M sit in band for the largest hunger-relief org in the country. The partnership consideration: corporate partnerships are typically national-tier with high minimums, and local volunteer events route through their 200+ member food bank affiliates rather than the national org directly. If Acme wants Austin-specific volunteer engagement, the Central Texas Food Bank route is more direct. Comfortable for a national-tier sponsor relationship; less aligned for hands-on local volunteering.",
    tail: {
      concern_level: "low",
      things_to_verify: [
        "Whether national-tier corporate partnership minimums are within Acme's CSR budget.",
        "Whether they route corporate volunteers to the local food bank network (which is the more direct path).",
        "What restricted-fund options exist — disaster response, food rescue tech, child hunger.",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Boys & Girls Clubs of America (national) — solid, large
  {
    ein: "135562976",
    narrative:
      "Boys & Girls Clubs of America operates at $189M in FY2023 revenue with $178M in expenses — a healthy 94% deployment ratio. Year-over-year revenue is flat (+0.2%), which for a 5,000-affiliate national org is steadiness rather than weakness. Executive compensation of $1.5M for the lead officer is below peer national youth-development orgs. As a national umbrella, they don't run direct volunteer programs — engagement typically routes through local club affiliates, and Acme's existing relationship with the Austin & Travis County local affiliate is a more direct path for hands-on volunteer work. Comfortable for an enterprise-tier brand sponsorship; the existing Austin local relationship covers the volunteer side.",
    tail: {
      concern_level: "low",
      things_to_verify: [
        "Whether enterprise-tier sponsorship is within Acme's CSR budget compared to direct local funding.",
        "How sponsorship dollars route to local affiliates (general fund vs. restricted to specific clubs).",
        "Reporting cadence — large national orgs often have once-a-year impact reporting, which may not match Acme's quarterly cycle.",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // BGCA Austin (746087356) — already in_diligence in seed
  // This narrative pre-populates the seeded diligence doc so re-runs are stable.
  {
    ein: "746087356",
    narrative:
      "Boys & Girls Clubs of Austin & Travis County runs a strong youth-development program with deep community roots and a reputation for operational quality. FY2023 revenue is roughly $8.4M with $8.2M in expenses, sitting at a 98% deployment ratio. Year-over-year revenue grew modestly while program expense ratio dropped about 9% — worth understanding before committing budget at the primary-partner tier. Executive compensation is in band for the local-affiliate scale. The education and STEM fit for Acme's secondary cause area is good, but the operational considerations around working with minors (background checks, structured curricula) will add overhead Acme should plan for. Cautious — engage, but verify the program ratio shift before scaling spend.",
    tail: {
      concern_level: "medium",
      things_to_verify: [
        "What drove the 9% drop in program expense ratio — one-time facilities expense or a structural shift in overhead?",
        "Whether STEM Skills Workshop is staffed by their team or requires Acme engineers to lead curriculum.",
        "Their volunteer screening requirements — background checks for working with minors take 2-3 weeks.",
      ],
    },
  },
];

function tokenize(text: string): string[] {
  // Split into word-like chunks. We preserve leading whitespace by attaching it
  // to the following token so the stream feels natural to a reader.
  const chunks: string[] = [];
  const re = /(\s+\S+|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) chunks.push(m[1]);
  return chunks;
}

function buildChunks(text: string): { delta: string; delayMs: number }[] {
  const tokens = tokenize(text);
  // Combine some adjacent short tokens into 1-3 token bursts to mimic real
  // streaming behavior (LLMs emit variable token boundaries).
  const grouped: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const burstSize = pickBurstSize();
    grouped.push(tokens.slice(i, i + burstSize).join(""));
    i += burstSize;
  }
  return grouped.map((delta, idx) => {
    let delay = 60 + Math.floor(Math.random() * 80); // base 60-140ms
    // Pause slightly longer at end-of-sentence boundaries
    if (/[.!?]\s*$/.test(delta)) delay += 100 + Math.floor(Math.random() * 200);
    // First chunk has a longer "thinking" pause before any tokens land
    if (idx === 0) delay = 320 + Math.floor(Math.random() * 200);
    return { delta, delayMs: delay };
  });
}

function pickBurstSize(): number {
  const r = Math.random();
  if (r < 0.55) return 1;
  if (r < 0.85) return 2;
  return 3;
}

async function writeJson(relPath: string, value: unknown) {
  const full = path.join(process.cwd(), "src", "lib", "fixtures", relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(value, null, 2));
}

async function main() {
  for (const entry of ENTRIES) {
    const chunks = buildChunks(entry.narrative);
    const total = chunks.reduce((s, c) => s + c.delayMs, 0);
    await writeJson(`llm/diligence-narrative-${entry.ein}.json`, {
      totalDurationMs: total,
      chunks,
    });
    await writeJson(`llm/diligence-structured-${entry.ein}.json`, entry.tail);
    console.log(
      `✓ ${entry.ein}  narrative=${chunks.length} chunks / ${(total / 1000).toFixed(1)}s  concern=${entry.tail.concern_level}`,
    );
  }
  console.log(`\nWrote ${ENTRIES.length * 2} LLM fixtures.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
