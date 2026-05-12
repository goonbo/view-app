/**
 * Generates LLM fixtures for Phase 3:
 *   - Event draft (single default fixture for the textarea → draft flow)
 *   - Comms drafts (email/slack/calendar) for each seeded event + the
 *     fresh-creation default that the new-event flow lands on
 *
 * Run with: npx tsx src/lib/scripts/generate-event-fixtures.ts
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { EventDraft } from "@/lib/llm/event-draft";
import type {
  EmailComms,
  SlackComms,
  CalendarComms,
} from "@/lib/llm/comms-draft";

async function writeJson(rel: string, value: unknown) {
  const full = path.join(process.cwd(), "src", "lib", "fixtures", rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(value, null, 2));
}

// ──────────────────────────────────────────────────────────────
// Event draft fixture — credible "warehouse sort" interpretation
// of the placeholder text Maria sees on /events/new.
const EVENT_DRAFT: EventDraft = {
  title: "Quarterly Warehouse Produce Sort",
  description:
    "A three-hour Saturday morning shift sorting donated produce at our main warehouse. Volunteers will unload pallets, separate produce by type and condition, and repack into family-sized boxes. The sorted boxes feed into our mobile pantry distribution the following week.\n\nThe work is hands-on and physical. Volunteers leave with a clear sense of what scale food rescue looks like: 30 people in three hours typically clear 8,000-10,000 pounds.",
  suggested_capacity: 30,
  capacity_reasoning:
    "Past quarterly sorts have run comfortably at 25-32 volunteers; 30 hits the upper end without forcing overflow staging.",
  suggested_agenda: [
    "9:00 — Arrive, sign in, gloves and hairnets distributed",
    "9:15 — Brief from warehouse lead on sort criteria and safety",
    "9:30 — Sort and pack (two crews, rotating between pallets and packing tables)",
    "11:00 — Break: water, fruit, restrooms",
    "11:15 — Final pack and warehouse cleanup",
    "12:00 — Wrap, debrief, optional warehouse tour",
  ],
  supplies_needed: [
    "Closed-toe shoes (no sandals)",
    "Water bottle",
    "Light jacket (warehouse is cool in the morning)",
    "Photo ID for sign-in",
  ],
  followup_questions: [
    "Do you want to cap this at exactly 30 or allow up to 35 if a corporate group asks?",
    "Should the warehouse tour at 12:00 be confirmed or optional based on time?",
  ],
};

// ──────────────────────────────────────────────────────────────
// Comms drafts — one set per seeded event slug, used both for the
// pre-activated event and for any fresh activation.
type EventSpec = {
  slug: string;
  eventTitle: string;
  nonprofitName: string;
};

const SPECS: EventSpec[] = [
  {
    slug: "quarterly-warehouse-sort",
    eventTitle: "Quarterly Warehouse Sort",
    nonprofitName: "Central Texas Food Bank",
  },
  {
    slug: "volunteer-reading-hour",
    eventTitle: "Volunteer Reading Hour",
    nonprofitName: "Boys & Girls Clubs of Austin & Travis County",
  },
  {
    slug: "stem-skills-workshop",
    eventTitle: "STEM Skills Workshop",
    nonprofitName: "Boys & Girls Clubs of Austin & Travis County",
  },
  // Default — fresh event flow falls back here.
  {
    slug: "default",
    eventTitle: "Quarterly Warehouse Produce Sort",
    nonprofitName: "Central Texas Food Bank",
  },
];

const COMMS: Record<EventSpec["slug"], { email: EmailComms; slack: SlackComms; calendar: CalendarComms }> = {
  "quarterly-warehouse-sort": {
    email: {
      subject: "Saturday warehouse sort — 30 hands needed",
      body:
        "Hey team,\n\nWe're hosting a quarterly volunteer shift at Central Texas Food Bank's warehouse this Saturday from 9 to 12. Thirty of us, three hours of produce sorting and packing — what gets sorted feeds their mobile pantry distribution the next week.\n\nNo experience needed. Bring closed-toe shoes, a water bottle, and a light jacket (the warehouse is cool in the morning). Photo ID for sign-in. Parking is in their north lot.\n\nReply to this email to claim a spot. Slots are first-come; if we hit 30 I'll start a waitlist.\n\n— Marcus",
    },
    slack: {
      body:
        "Saturday warehouse sort at Central Texas Food Bank — 9-12, 30 spots, sorting produce for next week's mobile pantry. Closed-toe shoes, water bottle, photo ID. <https://acme.example/events/sort|Sign up here>.",
    },
    calendar: {
      body:
        "Volunteer shift at Central Texas Food Bank's main warehouse. Three-hour produce sort and pack, feeding into their mobile pantry distribution the following week. Wear closed-toe shoes and bring a water bottle. Photo ID for sign-in.",
    },
  },
  "volunteer-reading-hour": {
    email: {
      subject: "Bi-weekly reading hour — Boys & Girls Clubs",
      body:
        "Hey team,\n\nBoys & Girls Clubs of Austin & Travis County is restarting their volunteer reading hour at the Eastside Club. Twelve readers pair up with K-3 students for 45 minutes every other Wednesday afternoon.\n\nIf you've got an hour at 3pm on alternating Wednesdays and like reading aloud, this is a low-overhead way in. Background check required — BGC handles it, takes about two weeks, and once you're cleared you're cleared for the whole school year.\n\nReply if interested and Marcus will start the screening.\n\n— Marcus",
    },
    slack: {
      body:
        "Bi-weekly reading hour at the BGC Eastside Club, 3pm Wednesdays, 12 spots. K-3 students. Background check required (BGC runs it, ~2 weeks). Reply here if interested.",
    },
    calendar: {
      body:
        "Reading hour at BGC Eastside Club. Pair with a K-3 student and read together for 45 minutes. Bi-weekly recurring. Background check completion required before first session.",
    },
  },
  "stem-skills-workshop": {
    email: {
      subject: "STEM workshop — engineers needed for one session",
      body:
        "Hey team,\n\nBoys & Girls Clubs of Austin & Travis County is running a STEM Skills Workshop for middle schoolers and asked us for engineers to lead 4 small-group challenges. Eight volunteers, three hours, one Saturday.\n\nThe curriculum is on rails — they'll send build instructions and supplies a week ahead. You're leading small-group prototyping, not teaching theory. Background check required (BGC handles it, ~2 weeks).\n\nReply if you're up for it. Engineering background helpful but not required.\n\n— Marcus",
    },
    slack: {
      body:
        "STEM Skills Workshop at BGC, 8 spots, one Saturday. Middle schoolers + engineers leading small-group challenges. BGC sends curriculum + supplies. Background check required (~2 weeks). Reply to claim a spot.",
    },
    calendar: {
      body:
        "STEM workshop at BGC. Three-hour hands-on session with middle schoolers — engineering volunteers lead small-group prototyping challenges. Curriculum and supplies provided. Background check required.",
    },
  },
  default: {
    email: {
      subject: "Quarterly warehouse sort — Saturday, 30 hands needed",
      body:
        "Hey team,\n\nWe're hosting a quarterly volunteer shift at Central Texas Food Bank's warehouse this Saturday from 9 to 12. Thirty of us, three hours of produce sorting and packing — what gets sorted feeds their mobile pantry distribution the next week.\n\nNo experience needed. Bring closed-toe shoes, a water bottle, and a light jacket. Photo ID for sign-in. Parking is in their north lot.\n\nReply to this email to claim a spot. Slots are first-come; if we hit 30 I'll start a waitlist.\n\n— Marcus",
    },
    slack: {
      body:
        "Saturday warehouse sort at Central Texas Food Bank — 9-12, 30 spots, sorting produce for next week's mobile pantry. Closed-toe shoes, water bottle, photo ID. Sign up in this thread.",
    },
    calendar: {
      body:
        "Volunteer shift at Central Texas Food Bank's main warehouse. Three-hour produce sort and pack, feeding into their mobile pantry distribution the following week. Wear closed-toe shoes and bring a water bottle.",
    },
  },
};

async function main() {
  await writeJson("llm/event-draft-default.json", EVENT_DRAFT);
  for (const spec of SPECS) {
    const set = COMMS[spec.slug];
    await writeJson(`llm/comms-${spec.slug}-email.json`, set.email);
    await writeJson(`llm/comms-${spec.slug}-slack.json`, set.slack);
    await writeJson(`llm/comms-${spec.slug}-calendar.json`, set.calendar);
    console.log(`✓ comms-${spec.slug} written`);
  }
  console.log(`\nWrote 1 event draft + ${SPECS.length * 3} comms drafts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
