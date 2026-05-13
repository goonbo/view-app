/**
 * Static workspace registry. Mirrors `db/seed.ts` exactly so the workspace
 * switcher works without a live DB connection at Phase 1.
 *
 * Slugs are stable handles used in URLs and in the
 * `view.activeWorkspace` cookie that drives layout routing.
 */
export type WorkspaceRegistryEntry = {
  id: string;
  slug: string;
  name: string;
  type: "corporate" | "nonprofit";
  accent: "cyan" | "green";
  ein?: string;
  causeAreas: string[];
  size?: number;
  /**
   * Corporate-partner attribution token. Used by the nonprofit-side CRM
   * to color the employer pill on volunteer rows + profiles. Stays
   * undefined for nonprofit workspaces.
   */
  partnerToken?: "acme" | "lumen" | "boldfish";
  /** First user — used in greetings until proper auth ships. */
  primaryUser: { name: string; firstName: string; role: string; email: string };
  /** Where to land when this workspace is selected from `/`. */
  homePath: string;
  /**
   * Fixture-only workspaces don't get a card on the landing page
   * (Lumen and Boldfish are real to the data layer but invisible to
   * the workspace switcher — they represent corporate partners whose
   * employees show up on Habitat's CRM).
   */
  hideOnLanding?: boolean;
};

/**
 * Deterministic UUIDs — stable across seed runs so dev URLs survive a wipe.
 */
export const WORKSPACE_IDS = {
  acme: "61636d65-0000-4000-8000-000000000c40",
  gafb: "67616662-0000-4000-8000-000000000c30",
  bgca: "62676361-0000-4000-8000-000000000c30",
  // v2 — nonprofit-workspace expansion
  hgsf: "68677366-0000-4000-8000-000000000c30", // Habitat for Humanity GSF
  lumen: "6c756d65-0000-4000-8000-000000000c40", // Lumen Industries (fixture-only)
  boldfish: "626f6c64-0000-4000-8000-000000000c40", // Boldfish Co. (fixture-only)
} as const;

export const WORKSPACES: WorkspaceRegistryEntry[] = [
  {
    id: WORKSPACE_IDS.acme,
    slug: "acme",
    name: "Acme Robotics",
    type: "corporate",
    accent: "cyan",
    size: 320,
    partnerToken: "acme",
    causeAreas: ["education", "food security", "workforce development"],
    primaryUser: {
      name: "Maya Chen",
      firstName: "Maya",
      role: "Director of Community Impact",
      email: "maya@acme.example",
    },
    homePath: "/workbench",
  },
  {
    id: WORKSPACE_IDS.lumen,
    slug: "lumen",
    name: "Lumen Industries",
    type: "corporate",
    accent: "cyan",
    size: 120,
    partnerToken: "lumen",
    causeAreas: ["housing", "education"],
    primaryUser: {
      name: "Priya Subbu",
      firstName: "Priya",
      role: "Community Impact Lead",
      email: "priya@lumen.example",
    },
    homePath: "/workbench",
    hideOnLanding: true,
  },
  {
    id: WORKSPACE_IDS.boldfish,
    slug: "boldfish",
    name: "Boldfish Co.",
    type: "corporate",
    accent: "cyan",
    size: 80,
    partnerToken: "boldfish",
    causeAreas: ["housing", "community"],
    primaryUser: {
      name: "Jamie Okafor",
      firstName: "Jamie",
      role: "People Operations",
      email: "jamie@boldfish.example",
    },
    homePath: "/workbench",
    hideOnLanding: true,
  },
  {
    id: WORKSPACE_IDS.hgsf,
    slug: "hgsf",
    name: "Habitat for Humanity Greater SF",
    type: "nonprofit",
    accent: "green",
    ein: "94-3088881",
    causeAreas: ["housing", "community"],
    primaryUser: {
      name: "Lina Tran",
      firstName: "Lina",
      role: "Volunteer & Partnerships Lead",
      email: "lina@habitatgsf.example",
    },
    homePath: "/np/workbench",
  },
  {
    id: WORKSPACE_IDS.gafb,
    slug: "gafb",
    name: "Central Texas Food Bank",
    type: "nonprofit",
    accent: "green",
    ein: "74-2217350",
    causeAreas: ["food security", "community"],
    primaryUser: {
      name: "Maria Velasquez",
      firstName: "Maria",
      role: "Volunteer & Community Coordinator",
      email: "maria@ctfb.example",
    },
    homePath: "/home",
  },
  {
    id: WORKSPACE_IDS.bgca,
    slug: "bgca",
    name: "Boys & Girls Clubs of Austin",
    type: "nonprofit",
    accent: "green",
    ein: "74-6087356",
    causeAreas: ["education", "youth"],
    primaryUser: {
      name: "David Park",
      firstName: "David",
      role: "Programs Manager",
      email: "david@bgca.example",
    },
    homePath: "/home",
  },
];

export function getWorkspaceBySlug(slug: string): WorkspaceRegistryEntry | undefined {
  return WORKSPACES.find((w) => w.slug === slug);
}

export const DEFAULT_CORPORATE_WORKSPACE = WORKSPACES.find(
  (w) => w.type === "corporate",
)!;
export const DEFAULT_NONPROFIT_WORKSPACE = WORKSPACES.find(
  (w) => w.type === "nonprofit",
)!;
