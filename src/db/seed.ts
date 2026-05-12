/**
 * Run with: pnpm db:seed
 *
 * Populates a lived-in demo state: 3 workspaces, 4 users, 2 partners (one
 * vetted + approved diligence, one in_diligence with a ready-for-review
 * document), 4 events with signups, 2 campaigns, 1 match policy, 8
 * donations producing $4,800 in matches, and one completed recap with
 * 5 marketing artifacts.
 *
 * Delete-then-insert. Idempotent: safe to rerun.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "./client";
import {
  auditLog,
  commsDrafts,
  diligenceDocuments,
  donationCampaigns,
  donations,
  eventSignups,
  events,
  marketingArtifacts,
  matchPolicies,
  nonprofitPartners,
  recaps,
  snoozes,
  users,
  workspaces,
} from "./schema";
import { WORKSPACE_IDS } from "../lib/workspaces";

const USER_IDS = {
  maya: "00000001-0000-4000-8000-000000000001",
  marcus: "00000001-0000-4000-8000-000000000002",
  maria: "00000001-0000-4000-8000-000000000003",
  david: "00000001-0000-4000-8000-000000000004",
} as const;

const PARTNER_IDS = {
  gafb: "00000002-0000-4000-8000-000000000001",
  bgca: "00000002-0000-4000-8000-000000000002",
} as const;

const DILIGENCE_IDS = {
  gafb: "00000003-0000-4000-8000-000000000001",
  bgca: "00000003-0000-4000-8000-000000000002",
} as const;

const EVENT_IDS = {
  mobilePantry: "00000004-0000-4000-8000-000000000001",
  warehouseSort: "00000004-0000-4000-8000-000000000002",
  reading: "00000004-0000-4000-8000-000000000003",
  stem: "00000004-0000-4000-8000-000000000004",
} as const;

const CAMPAIGN_IDS = {
  holiday: "00000005-0000-4000-8000-000000000001",
  stemKits: "00000005-0000-4000-8000-000000000002",
} as const;

const MATCH_IDS = {
  annual: "00000006-0000-4000-8000-000000000001",
} as const;

const RECAP_IDS = {
  mobilePantry: "00000007-0000-4000-8000-000000000001",
} as const;

const now = new Date();
const days = (n: number): Date => new Date(now.getTime() + n * 86_400_000);

type CapturedOrg = {
  ein: string;
  legal_name: string;
  common_name?: string;
  address?: string;
  city?: string;
  state?: string;
  ntee_classification?: string;
  ruling_date?: string;
  mission?: string;
  total_assets?: number;
  filings: Array<{
    tax_period: number;
    total_revenue: number;
    total_expenses: number;
    program_service_revenue: number;
    executive_comp?: number;
    total_assets: number;
  }>;
};

let propublicaCache: CapturedOrg[] | null = null;

async function loadPropublicaOrg(ein: string): Promise<CapturedOrg | null> {
  if (!propublicaCache) {
    const filePath = path.join(
      process.cwd(),
      "src",
      "lib",
      "fixtures",
      "propublica",
      "organizations.json",
    );
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      propublicaCache = JSON.parse(raw) as CapturedOrg[];
    } catch {
      propublicaCache = [];
    }
  }
  const clean = ein.replace(/-/g, "");
  return propublicaCache.find((o) => o.ein === clean) ?? null;
}

function buildSignalsFromCapture(org: CapturedOrg): Record<string, unknown> {
  const latest = org.filings[0];
  const prev = org.filings[1];
  const yoy = prev
    ? ((latest.total_revenue - prev.total_revenue) / prev.total_revenue) * 100
    : null;
  return {
    verified_facts: {
      ein: org.ein,
      legal_name: org.legal_name,
      common_name: org.common_name,
      address: org.address,
      city: org.city,
      state: org.state,
      ntee_classification: org.ntee_classification,
      ruling_date: org.ruling_date,
      total_assets: org.total_assets,
      mission: org.mission,
    },
    filing_summary: latest
      ? {
          tax_period: latest.tax_period,
          total_revenue: latest.total_revenue,
          total_expenses: latest.total_expenses,
          program_service_revenue: latest.program_service_revenue,
          executive_comp: latest.executive_comp,
          total_assets: latest.total_assets,
          yoy_revenue_pct: yoy,
          program_revenue_share:
            latest.total_revenue > 0
              ? latest.program_service_revenue / latest.total_revenue
              : null,
          flags: {
            yoy_decline: yoy !== null && yoy < -15,
            low_program_share:
              latest.total_revenue > 0 &&
              latest.program_service_revenue / latest.total_revenue < 0.1,
          },
        }
      : null,
  };
}

async function clear() {
  await db.delete(auditLog);
  await db.delete(snoozes);
  await db.delete(marketingArtifacts);
  await db.delete(recaps);
  await db.delete(donations);
  await db.delete(matchPolicies);
  await db.delete(donationCampaigns);
  await db.delete(commsDrafts);
  await db.delete(eventSignups);
  await db.delete(events);
  await db.delete(diligenceDocuments);
  await db.delete(nonprofitPartners);
  await db.delete(users);
  await db.delete(workspaces);
}

async function insertWorkspaces() {
  await db.insert(workspaces).values([
    {
      id: WORKSPACE_IDS.acme,
      name: "Acme Robotics",
      type: "corporate",
      accent: "cyan",
      size: 320,
      causeAreas: ["education", "food security", "workforce development"],
    },
    {
      id: WORKSPACE_IDS.gafb,
      name: "Central Texas Food Bank",
      type: "nonprofit",
      accent: "green",
      ein: "742217350",
      causeAreas: ["food security", "community"],
    },
    {
      id: WORKSPACE_IDS.bgca,
      name: "Boys & Girls Clubs of Austin",
      type: "nonprofit",
      accent: "green",
      ein: "746087356",
      causeAreas: ["education", "youth"],
    },
  ]);
}

async function insertUsers() {
  await db.insert(users).values([
    {
      id: USER_IDS.maya,
      workspaceId: WORKSPACE_IDS.acme,
      name: "Maya Chen",
      role: "Director of Community Impact",
      email: "maya@acme.example",
    },
    {
      id: USER_IDS.marcus,
      workspaceId: WORKSPACE_IDS.acme,
      name: "Marcus Rivera",
      role: "People Ops Manager",
      email: "marcus@acme.example",
    },
    {
      id: USER_IDS.maria,
      workspaceId: WORKSPACE_IDS.gafb,
      name: "Maria Velasquez",
      role: "Volunteer & Community Coordinator",
      email: "maria@ctfb.example",
    },
    {
      id: USER_IDS.david,
      workspaceId: WORKSPACE_IDS.bgca,
      name: "David Park",
      role: "Programs Manager",
      email: "david@bgca.example",
    },
  ]);
}

async function insertPartners() {
  await db.insert(nonprofitPartners).values([
    {
      id: PARTNER_IDS.gafb,
      corporateWorkspaceId: WORKSPACE_IDS.acme,
      nonprofitWorkspaceId: WORKSPACE_IDS.gafb,
      ein: "742217350",
      legalName: "Central Texas Food Bank Inc",
      commonName: "Central Texas Food Bank",
      mission:
        "Nourish hungry people and lead the community in ending hunger across Central Texas.",
      location: "Austin, TX",
      website: "https://www.centraltexasfoodbank.org",
      causeAreas: ["food security", "community"],
      status: "vetted",
      matchEligible: true,
    },
    {
      id: PARTNER_IDS.bgca,
      corporateWorkspaceId: WORKSPACE_IDS.acme,
      nonprofitWorkspaceId: WORKSPACE_IDS.bgca,
      ein: "746087356",
      legalName: "Boys And Girls Clubs Of Austin And Travis County Inc",
      commonName: "Boys & Girls Clubs of Austin & Travis County",
      mission:
        "Enable young people, especially those who need us most, to reach their full potential.",
      location: "Austin, TX",
      website: "https://www.bgcaustin.org",
      causeAreas: ["education", "youth"],
      status: "in_diligence",
      matchEligible: false,
    },
  ]);
}

async function insertDiligenceDocuments() {
  // Hydrate signals from the captured ProPublica fixtures so the saved
  // snapshots match the shape the streaming UI produces.
  const gafbOrg = await loadPropublicaOrg("742217350");
  const bgcaOrg = await loadPropublicaOrg("746087356");

  await db.insert(diligenceDocuments).values([
    {
      id: DILIGENCE_IDS.gafb,
      partnerId: PARTNER_IDS.gafb,
      workspaceId: WORKSPACE_IDS.acme,
      ein: "742217350",
      status: "approved",
      concernLevel: "low",
      narrative:
        "Central Texas Food Bank operates at $116M in FY2023 revenue with $111M in expenses — a 96% deployment ratio that's standard for a food bank of this scale. Executive compensation is in band for a 200-plus FTE Texas org. The cause-area fit for Acme's food-security focus is direct, and they have a track record of corporate volunteer groups at the 30-50 employee scale. Comfortable to engage as a primary partner.",
      signals: gafbOrg ? buildSignalsFromCapture(gafbOrg) : {},
      thingsToVerify: [
        "Capacity for 30+ corporate volunteers on a single Saturday shift.",
        "Whether their warehouse is accessible for employees with mobility needs.",
        "Whether the matching gift goes to general operations or restricted programs.",
      ],
      approvedBy: USER_IDS.maya,
      approvedAt: days(-90),
      generatedAt: days(-91),
    },
    {
      id: DILIGENCE_IDS.bgca,
      partnerId: PARTNER_IDS.bgca,
      workspaceId: WORKSPACE_IDS.acme,
      ein: "746087356",
      status: "ready_for_review",
      concernLevel: "medium",
      narrative:
        "Boys & Girls Clubs of Austin & Travis County runs a strong youth-development program with deep community roots and a reputation for operational quality. Year-over-year revenue grew modestly while program expense ratio dropped about 9% — worth understanding before committing budget at the primary-partner tier. Executive compensation is in band for the local-affiliate scale. The education and STEM fit for Acme's secondary cause area is good, but the operational considerations around working with minors (background checks, structured curricula) will add overhead Acme should plan for. Cautious — engage, but verify the program ratio shift before scaling spend.",
      signals: bgcaOrg ? buildSignalsFromCapture(bgcaOrg) : {},
      thingsToVerify: [
        "What drove the 9% drop in program ratio — one-time facilities expense or a structural shift?",
        "Whether STEM Skills Workshop is staffed by their team or needs Acme engineers.",
        "Their volunteer screening requirements (background checks for working with minors).",
      ],
      generatedAt: days(-3),
    },
  ]);
}

async function insertEvents() {
  await db.insert(events).values([
    {
      id: EVENT_IDS.mobilePantry,
      nonprofitWorkspaceId: WORKSPACE_IDS.gafb,
      partnerId: PARTNER_IDS.gafb,
      corporateWorkspaceId: WORKSPACE_IDS.acme,
      title: "Q1 Mobile Pantry Distribution",
      description:
        "A morning of mobile pantry distribution at a partner church in southeast Austin. Volunteers will unload pallets, sort produce, and serve clients drive-through style.",
      location: "Mt. Sinai Baptist Church, Austin TX",
      startsAt: days(-42),
      endsAt: days(-42),
      capacity: 25,
      confirmedCapacity: 25,
      format: "onsite",
      causeAreas: ["food security"],
      aiBrief:
        "A morning of mobile pantry distribution at a partner church in southeast Austin.",
      aiBriefApproved: true,
      status: "completed",
      activatedAt: days(-65),
      sharedNotes:
        "Volunteers loved the drive-through format. Several asked about coming back monthly.",
    },
    {
      id: EVENT_IDS.warehouseSort,
      nonprofitWorkspaceId: WORKSPACE_IDS.gafb,
      partnerId: PARTNER_IDS.gafb,
      corporateWorkspaceId: WORKSPACE_IDS.acme,
      title: "Quarterly Warehouse Sort",
      description:
        "A three-hour Saturday morning shift sorting donated produce in the food bank's main warehouse. Bring closed-toe shoes and a water bottle.",
      location: "GAFB Warehouse, 6500 Metropolis Dr, Austin TX",
      startsAt: days(8),
      endsAt: days(8),
      capacity: 30,
      confirmedCapacity: 30,
      format: "onsite",
      causeAreas: ["food security"],
      aiBrief:
        "A three-hour Saturday morning shift sorting donated produce in the food bank's main warehouse.",
      aiBriefApproved: true,
      sharedNotes:
        "Maya — please confirm parking situation for the Acme group. We can hold 30 in our north lot.",
      supplies: [
        "Closed-toe shoes",
        "Water bottle",
        "Light jacket (warehouse is cool in the morning)",
      ],
      status: "activated",
      activatedAt: days(-14),
    },
    {
      id: EVENT_IDS.reading,
      nonprofitWorkspaceId: WORKSPACE_IDS.bgca,
      title: "Volunteer Reading Hour",
      description:
        "Bi-weekly reading hour with K-3 students at the Eastside Club. Pair up with a kid and read together for 45 minutes.",
      location: "BGC Eastside Club, Austin TX",
      startsAt: days(14),
      endsAt: days(14),
      capacity: 12,
      format: "onsite",
      causeAreas: ["education", "youth"],
      aiBriefApproved: false,
      status: "open",
    },
    {
      id: EVENT_IDS.stem,
      nonprofitWorkspaceId: WORKSPACE_IDS.bgca,
      title: "STEM Skills Workshop",
      description:
        "Hands-on workshop for middle schoolers. Looking for engineering volunteers to lead small-group challenges.",
      location: "BGC Westside Club, Austin TX",
      startsAt: days(21),
      endsAt: days(21),
      capacity: 8,
      format: "skills_based",
      causeAreas: ["education", "workforce development"],
      aiBriefApproved: false,
      status: "open",
    },
  ]);

  const attendees = Array.from({ length: 22 }, (_, i) => ({
    eventId: EVENT_IDS.mobilePantry,
    employeeName: `Acme Employee ${i + 1}`,
    employeeEmail: `employee${i + 1}@acme.example`,
    status: "checked_in",
    hoursLogged: "3.00",
  }));
  const noShows = Array.from({ length: 3 }, (_, i) => ({
    eventId: EVENT_IDS.mobilePantry,
    employeeName: `Acme Employee ${i + 23}`,
    employeeEmail: `employee${i + 23}@acme.example`,
    status: "no_show",
    hoursLogged: null,
  }));
  await db.insert(eventSignups).values([...attendees, ...noShows]);

  await db.insert(eventSignups).values(
    Array.from({ length: 24 }, (_, i) => ({
      eventId: EVENT_IDS.warehouseSort,
      employeeName: `Acme Employee ${i + 1}`,
      employeeEmail: `employee${i + 1}@acme.example`,
      status: "registered",
      hoursLogged: null,
    })),
  );
}

async function insertCampaigns() {
  await db.insert(donationCampaigns).values([
    {
      id: CAMPAIGN_IDS.holiday,
      nonprofitWorkspaceId: WORKSPACE_IDS.gafb,
      title: "Holiday Food Drive 2026",
      story:
        "Funds the cost of holiday meal kits for 2,500 families across Central Texas. Each kit feeds a family of four for a week.",
      causeAreas: ["food security"],
      goalAmount: "25000.00",
      startsAt: days(-40),
      endsAt: days(50),
      aiBriefApproved: true,
      givingLadder: [
        { amount: 25, description: "Provides 5 family meals" },
        { amount: 50, description: "Provides 10 family meals" },
        { amount: 100, description: "Fills one holiday meal kit" },
        { amount: 250, description: "Funds a week of distribution at one site" },
      ],
      status: "open",
    },
    {
      id: CAMPAIGN_IDS.stemKits,
      nonprofitWorkspaceId: WORKSPACE_IDS.bgca,
      title: "Back-to-School STEM Kits",
      story:
        "Buys hands-on STEM kits for 200 club members heading into the new school year.",
      causeAreas: ["education", "youth"],
      goalAmount: "8000.00",
      startsAt: days(-5),
      endsAt: days(55),
      aiBriefApproved: false,
      status: "open",
    },
  ]);
}

async function insertMatchAndDonations() {
  await db.insert(matchPolicies).values([
    {
      id: MATCH_IDS.annual,
      corporateWorkspaceId: WORKSPACE_IDS.acme,
      name: "2026 Annual Match",
      eligiblePartnerIds: [PARTNER_IDS.gafb],
      matchRatio: "1.00",
      capPerEmployee: "1000.00",
      capTotal: "12500.00",
      status: "active",
      startsAt: days(-120),
      endsAt: days(245),
    },
  ]);

  const donationAmounts = [200, 500, 1000, 750, 600, 350, 800, 600];
  await db.insert(donations).values(
    donationAmounts.map((amount, i) => ({
      campaignId: CAMPAIGN_IDS.holiday,
      employeeName: `Acme Employee ${i + 1}`,
      employeeEmail: `employee${i + 1}@acme.example`,
      corporateWorkspaceId: WORKSPACE_IDS.acme,
      amount: amount.toFixed(2),
      matchAmount: amount.toFixed(2),
      matchPolicyId: MATCH_IDS.annual,
      partnerId: PARTNER_IDS.gafb,
      status: "matched",
      createdAt: days(-30 + i * 3),
    })),
  );
}

async function insertRecapAndArtifacts() {
  await db.insert(recaps).values([
    {
      id: RECAP_IDS.mobilePantry,
      workspaceId: WORKSPACE_IDS.acme,
      scope: "event",
      scopeTargetId: EVENT_IDS.mobilePantry,
      periodStart: days(-49),
      periodEnd: days(-35),
      title: "Q1 Mobile Pantry — Recap",
      lede:
        "Twenty-two Acme employees spent a Saturday morning unloading pallets and serving 410 families at our Mt. Sinai distribution site.",
      narrativeMd:
        "## Q1 Mobile Pantry Distribution\n\nTwenty-two Acme employees spent a Saturday morning unloading pallets and serving 410 families at our Mt. Sinai distribution site. The drive-through format worked well — no client wait exceeded 8 minutes after the first half-hour.\n\n### What worked\n- Pre-event sort on Friday afternoon cut Saturday setup by 35 minutes.\n- The two engineering interns paired with our regular Saturday volunteers and ran the produce table without supervision after 30 minutes.\n- Marcus's logistics email three days out drove 88% confirmation; only three no-shows on the day.\n\n### What drifted\n- We over-ordered cardboard boxes for repacking. About 40 unused boxes went back to the warehouse.\n- The route from the parking lot to the staging area is not great for wheelchairs. One volunteer had to ask for a different role mid-event.\n\n### Recommendations for next quarter\n1. Add a single line to the registration form asking about mobility needs.\n2. Order boxes against actual prior-event consumption, not headcount × 2.\n3. Repeat the Friday pre-sort — it paid for itself.",
      byTheNumbers: {
        hours: 66,
        volunteers: 22,
        families_served: 410,
        no_shows: 3,
        donations_matched: 0,
      },
      outcomes: [
        {
          headline: "Drive-through pacing held under 8 minutes",
          body: "Client wait stayed under 8 minutes after the first half hour. The pre-event sort meaningfully reduced setup time and is worth keeping.",
        },
        {
          headline: "Two interns ran the produce table unsupervised",
          body: "Engineering interns Janelle and Reza paired with regular Saturday volunteers and were running the table independently within 30 minutes — a low-friction onboarding worth modeling.",
        },
        {
          headline: "Mobility access is not solved",
          body: "One volunteer had to switch roles mid-event because the warehouse-to-staging route isn't wheelchair-friendly. Worth flagging on registration going forward.",
        },
      ],
      recommendations: [
        {
          headline: "Add mobility question to registration",
          body: "A single line on the form would have surfaced the issue before Saturday morning and given us time to plan around it.",
        },
        {
          headline: "Order boxes against prior-event consumption, not headcount",
          body: "We ordered for headcount × 2 and shipped 40 unused back to the warehouse. Past three events suggest 1.2× consumption is the right multiplier.",
        },
        {
          headline: "Repeat the Friday pre-sort",
          body: "It cut Saturday setup time by 35 minutes and paid for itself in volunteer hours saved. Make it a standing operating procedure.",
        },
      ],
      status: "approved",
      generatedAt: days(-35),
      approvedAt: days(-34),
    },
  ]);

  await db.insert(marketingArtifacts).values([
    {
      recapId: RECAP_IDS.mobilePantry,
      kind: "linkedin",
      contentMd:
        "Last Saturday, 22 of our team spent the morning at Central Texas Food Bank's mobile pantry. We unloaded pallets, sorted produce, and helped 410 families take home a week of groceries. Drive-through pacing stayed under 8 minutes after the first half hour — credit to Maria Velasquez and the GAFB team for the operational craft. Our second quarter of partnering with them.\n\nIf you want to volunteer with us, ping Marcus.\n\n410 families. One Saturday morning. #foodsecurity",
      status: "approved",
      approvedAt: days(-34),
    },
    {
      recapId: RECAP_IDS.mobilePantry,
      kind: "newsletter",
      contentMd:
        "Team — last Saturday 22 of you showed up at the Central Texas Food Bank's mobile pantry and helped serve 410 families. Special thanks to Janelle and Reza for jumping into the produce table on day one. As Maria from GAFB put it: *\"You all moved faster than my regular Saturday crew, which is saying something.\"* Our Q2 sort is on the calendar. — Maya",
      status: "approved",
      approvedAt: days(-34),
    },
    {
      recapId: RECAP_IDS.mobilePantry,
      kind: "all_hands",
      contentMd:
        "410 FAMILIES IN A SATURDAY\n\n- 22 Acme employees on-site at GAFB mobile pantry\n- 66 volunteer hours logged\n- Sub-8-minute drive-through wait after the first half hour\n- Two engineering interns ran the produce table\n- Friday pre-sort cut setup by 35 minutes\n- Q2 warehouse sort: April 18, signups open Monday",
      status: "approved",
      approvedAt: days(-34),
    },
    {
      recapId: RECAP_IDS.mobilePantry,
      kind: "social_short",
      contentMd:
        "22 of our team. 66 hours. 410 families served at the Central Texas Food Bank mobile pantry last Saturday. Q2 sort on April 18 — DM Marcus to join.",
      status: "approved",
      approvedAt: days(-34),
    },
    {
      recapId: RECAP_IDS.mobilePantry,
      kind: "csr_page",
      contentMd:
        "Our community partnership with Central Texas Food Bank brought 22 Acme team members to their mobile pantry distribution this quarter. Together, we helped serve 410 families across southeast Austin — 66 hours of work, one Saturday. The food bank operates at a 93% program expense ratio and serves Central Texas year-round. Our matching gift program covers employee donations to GAFB at 1:1 through the end of the year. Food security is one of three causes Acme commits to as a company.",
      status: "approved",
      approvedAt: days(-34),
    },
  ]);
}

async function insertAuditTrail() {
  await db.insert(auditLog).values([
    {
      workspaceId: WORKSPACE_IDS.acme,
      actorId: USER_IDS.maya,
      actorKind: "user",
      action: "diligence.approved",
      targetType: "diligence_document",
      targetId: DILIGENCE_IDS.gafb,
      payload: { partner: "Central Texas Food Bank" },
      at: days(-90),
    },
    {
      workspaceId: WORKSPACE_IDS.acme,
      actorId: USER_IDS.maya,
      actorKind: "user",
      action: "recap.approved",
      targetType: "recap",
      targetId: RECAP_IDS.mobilePantry,
      payload: { title: "Q1 Mobile Pantry — Recap" },
      at: days(-34),
    },
  ]);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "\nDATABASE_URL is not set. Copy .env.example to .env.local and add a Neon connection string.\n",
    );
    process.exit(1);
  }

  console.log("Clearing existing data…");
  await clear();
  console.log("Inserting workspaces…");
  await insertWorkspaces();
  console.log("Inserting users…");
  await insertUsers();
  console.log("Inserting nonprofit partners…");
  await insertPartners();
  console.log("Inserting diligence documents…");
  await insertDiligenceDocuments();
  console.log("Inserting events + signups…");
  await insertEvents();
  console.log("Inserting donation campaigns…");
  await insertCampaigns();
  console.log("Inserting match policy + donations…");
  await insertMatchAndDonations();
  console.log("Inserting recap + marketing artifacts…");
  await insertRecapAndArtifacts();
  console.log("Inserting audit trail…");
  await insertAuditTrail();

  console.log("\n✓ Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
