/**
 * Static workspace registry. Mirrors `db/seed.ts` exactly so the workspace
 * switcher works without a live DB connection at Phase 1.
 *
 * Slugs are stable handles used in URLs (`/w/acme/workbench`) and in the
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
  /** First user — used in greetings until proper auth ships. */
  primaryUser: { name: string; firstName: string; role: string; email: string };
  /** Where to land when this workspace is selected from `/`. */
  homePath: string;
};

/**
 * Deterministic UUIDs — stable across seed runs so dev URLs survive a wipe.
 * Generated once by hand from short seeds; do not regenerate without also
 * resetting any captured fixtures that reference them.
 */
export const WORKSPACE_IDS = {
  acme: "61636d65-0000-4000-8000-000000000c40",
  gafb: "67616662-0000-4000-8000-000000000c30",
  bgca: "62676361-0000-4000-8000-000000000c30",
} as const;

export const WORKSPACES: WorkspaceRegistryEntry[] = [
  {
    id: WORKSPACE_IDS.acme,
    slug: "acme",
    name: "Acme Robotics",
    type: "corporate",
    accent: "cyan",
    size: 320,
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
