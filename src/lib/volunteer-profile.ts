import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  eventSignups,
  events,
  nonprofitVolunteerOverlay,
  workspaces,
} from "@/db/schema";

export type VolunteerProfile = {
  employeeEmail: string;
  fullName: string;
  /** Corporate workspace this volunteer belongs to (inferred from their events). */
  employerWorkspaceId: string;
  employerName: string;
  /** Color token: matches WorkspaceRegistryEntry.partnerToken. */
  employerToken: "acme" | "lumen" | "boldfish";
  totalHours: number;
  eventCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  tags: string[];
  notes: string | null;
  capacitySignal: string | null;
};

const TOKEN_BY_NAME: Record<string, "acme" | "lumen" | "boldfish"> = {
  "Acme Robotics": "acme",
  "Lumen Industries": "lumen",
  "Boldfish Co.": "boldfish",
};

/**
 * Returns all volunteers who have attended an event owned by this
 * nonprofit workspace. Aggregates signups by employee_email, joins the
 * nonprofit_volunteer_overlay for nonprofit-side fields, and joins
 * workspaces for the employer label + color token.
 */
export async function listVolunteerProfiles(
  nonprofitWorkspaceId: string,
): Promise<VolunteerProfile[]> {
  // Aggregate per (employee_email, corporate_workspace_id) using the
  // events table for the employer attribution. Each signup row joins
  // events to discover which corp workspace activated that event.
  // CROSS_WORKSPACE_READ: this aggregation reads signups + events
  // owned by the nonprofit; the corporate workspace is referenced
  // through events.corporate_workspace_id which is the activation
  // relationship.
  const rows = await db
    .select({
      employeeEmail: eventSignups.employeeEmail,
      employeeName: eventSignups.employeeName,
      corporateWorkspaceId: events.corporateWorkspaceId,
      hoursSum: sql<string>`COALESCE(SUM(${eventSignups.hoursLogged}), 0)`,
      eventCount: sql<string>`COUNT(*)`,
      firstSeen: sql<string>`MIN(${events.startsAt})`,
      lastSeen: sql<string>`MAX(${events.startsAt})`,
    })
    .from(eventSignups)
    .innerJoin(events, eq(events.id, eventSignups.eventId))
    .where(eq(events.nonprofitWorkspaceId, nonprofitWorkspaceId))
    .groupBy(
      eventSignups.employeeEmail,
      eventSignups.employeeName,
      events.corporateWorkspaceId,
    );

  if (rows.length === 0) return [];

  // Pull the corporate workspace names for the employer label + token.
  const corpIds = Array.from(
    new Set(rows.map((r) => r.corporateWorkspaceId).filter(Boolean)),
  ) as string[];
  const corpRows = corpIds.length
    ? await db
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(inArray(workspaces.id, corpIds))
    : [];
  const corpById = new Map(corpRows.map((c) => [c.id, c.name]));

  // Pull the overlay rows (one per email) for tags/notes/capacity.
  const emails = rows.map((r) => r.employeeEmail);
  const overlays = await db
    .select()
    .from(nonprofitVolunteerOverlay)
    .where(
      and(
        eq(nonprofitVolunteerOverlay.nonprofitWorkspaceId, nonprofitWorkspaceId),
        inArray(nonprofitVolunteerOverlay.employeeEmail, emails),
      ),
    );
  const overlayByEmail = new Map(overlays.map((o) => [o.employeeEmail, o]));

  return rows
    .map((r) => {
      const employerName = corpById.get(r.corporateWorkspaceId ?? "") ?? "Unknown";
      const overlay = overlayByEmail.get(r.employeeEmail);
      return {
        employeeEmail: r.employeeEmail,
        fullName: r.employeeName,
        employerWorkspaceId: r.corporateWorkspaceId ?? "",
        employerName,
        employerToken: TOKEN_BY_NAME[employerName] ?? "acme",
        totalHours: Math.round(Number(r.hoursSum ?? 0)),
        eventCount: Number(r.eventCount ?? 0),
        firstSeenAt: new Date(r.firstSeen),
        lastSeenAt: new Date(r.lastSeen),
        tags: overlay?.tags ?? [],
        notes: overlay?.notes ?? null,
        capacitySignal: overlay?.capacitySignal ?? null,
      } satisfies VolunteerProfile;
    })
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

export type VolunteerProfileWithHistory = VolunteerProfile & {
  history: Array<{
    eventId: string;
    eventTitle: string;
    eventDate: Date;
    status: string;
    hoursLogged: number | null;
    corporateWorkspaceId: string | null;
    corporateWorkspaceName: string | null;
  }>;
};

/**
 * Same shape as listVolunteerProfiles but for a single volunteer, plus
 * the full event history. Used by /np/volunteers/[id].
 */
export async function getVolunteerProfile(
  nonprofitWorkspaceId: string,
  employeeEmail: string,
): Promise<VolunteerProfileWithHistory | null> {
  const all = await listVolunteerProfiles(nonprofitWorkspaceId);
  const base = all.find((v) => v.employeeEmail === employeeEmail);
  if (!base) return null;

  const historyRows = await db
    .select({
      eventId: events.id,
      eventTitle: events.title,
      eventDate: events.startsAt,
      status: eventSignups.status,
      hoursLogged: eventSignups.hoursLogged,
      corporateWorkspaceId: events.corporateWorkspaceId,
    })
    .from(eventSignups)
    .innerJoin(events, eq(events.id, eventSignups.eventId))
    .where(
      and(
        eq(events.nonprofitWorkspaceId, nonprofitWorkspaceId),
        eq(eventSignups.employeeEmail, employeeEmail),
      ),
    )
    .orderBy(desc(events.startsAt));

  const corpIds = Array.from(
    new Set(historyRows.map((r) => r.corporateWorkspaceId).filter(Boolean)),
  ) as string[];
  const corpRows = corpIds.length
    ? await db
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(inArray(workspaces.id, corpIds))
    : [];
  const corpById = new Map(corpRows.map((c) => [c.id, c.name]));

  return {
    ...base,
    history: historyRows.map((r) => ({
      eventId: r.eventId,
      eventTitle: r.eventTitle,
      eventDate: r.eventDate,
      status: r.status,
      hoursLogged: r.hoursLogged !== null ? Number(r.hoursLogged) : null,
      corporateWorkspaceId: r.corporateWorkspaceId,
      corporateWorkspaceName: r.corporateWorkspaceId
        ? corpById.get(r.corporateWorkspaceId) ?? null
        : null,
    })),
  };
}

/** Distinct tags across all volunteers in this workspace. */
export async function listVolunteerTags(
  nonprofitWorkspaceId: string,
): Promise<string[]> {
  const rows = await db
    .select({ tags: nonprofitVolunteerOverlay.tags })
    .from(nonprofitVolunteerOverlay)
    .where(eq(nonprofitVolunteerOverlay.nonprofitWorkspaceId, nonprofitWorkspaceId));
  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  return Array.from(set).sort();
}
