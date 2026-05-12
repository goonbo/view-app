import { NextResponse } from "next/server";
import { and, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
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
} from "@/db/schema";
import { getActiveWorkspace } from "@/lib/active-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type WorkbenchFeed = {
  ambient_stats: {
    quarter_hours: { value: number; delta_label: string };
    matched_ytd: { value: number; cap: number | null; delta_label: string };
    active_partners: { value: number; delta_label: string };
  };
  pending_review: PendingReviewItem[];
  upcoming: UpcomingItem[];
  active_campaigns: ActiveCampaignItem[];
  partner_activity: PartnerActivityItem[];
  recently_shipped: RecentlyShippedRow | null;
  next_event_summary: { title: string; days_until: number } | null;
};

export type PendingReviewItem = {
  id: string;
  /** Type of underlying entity — drives icon + click destination. */
  kind: "diligence" | "comms" | "event_open" | "campaign_open" | "recap";
  title: string;
  reasoning: string;
  href: string;
  drafted_label: string;
  concern_level: "low" | "medium" | "high" | null;
  target_id: string;
};

export type UpcomingItem = {
  id: string;
  title: string;
  partnerName: string;
  startsAt: string;
  location: string | null;
  signupRatio: { registered: number; capacity: number };
  daysUntil: number;
};

export type ActiveCampaignItem = {
  id: string;
  title: string;
  partnerName: string;
  raised: number;
  goal: number;
  endsAt: string;
};

export type PartnerActivityItem = {
  id: string;
  kind: "event_published" | "campaign_published" | "supplies_updated" | "notes_updated" | "event_completed" | "donation_thanks";
  message: string;
  at: string;
  partnerName: string;
};

export type RecentlyShippedRow = {
  recap_id: string;
  title: string;
  artifact_count: number;
  approved_at: string;
};

export async function GET() {
  const ws = await getActiveWorkspace();
  if (!ws || ws.type !== "corporate") {
    return NextResponse.json({ error: "Corporate workspace required" }, { status: 403 });
  }

  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const quarterStart = startOfQuarter(now);
  const prevQuarterStart = startOfQuarter(addQuarters(now, -1));

  // ─────────────────────────────────────────────────────────────
  // Partner roster + their workspace ids (for cross-workspace queries)
  const partners = await db
    .select()
    .from(nonprofitPartners)
    .where(eq(nonprofitPartners.corporateWorkspaceId, ws.id));
  const vettedPartners = partners.filter((p) => p.status === "vetted");
  const vettedPartnerIds = vettedPartners.map((p) => p.id);
  const vettedWorkspaceIds = vettedPartners
    .map((p) => p.nonprofitWorkspaceId)
    .filter((id): id is string => !!id);
  const partnerNameByWorkspaceId = new Map(
    vettedPartners.map((p) => [p.nonprofitWorkspaceId ?? "", p.commonName]),
  );
  const partnerNameById = new Map(partners.map((p) => [p.id, p.commonName]));

  // ─────────────────────────────────────────────────────────────
  // AMBIENT STATS
  // 1. Quarter hours — sum of hours_logged across signups of events from
  //    vetted partners whose start was in this quarter, vs. last quarter.
  let quarterHours = 0;
  let prevQuarterHours = 0;
  if (vettedPartnerIds.length) {
    const hoursRows = await db
      .select({
        starts_at: events.startsAt,
        hours: sql<string>`COALESCE(SUM(${eventSignups.hoursLogged}), 0)`,
      })
      .from(events)
      .leftJoin(eventSignups, eq(eventSignups.eventId, events.id))
      .where(
        and(
          inArray(events.partnerId, vettedPartnerIds),
          gte(events.startsAt, prevQuarterStart),
        ),
      )
      .groupBy(events.id, events.startsAt);
    for (const row of hoursRows) {
      const h = Number(row.hours);
      if (row.starts_at >= quarterStart) quarterHours += h;
      else prevQuarterHours += h;
    }
  }
  const hoursDelta =
    prevQuarterHours > 0
      ? Math.round(((quarterHours - prevQuarterHours) / prevQuarterHours) * 100)
      : 0;

  // 2. Matched YTD across this workspace
  const [matchedYtdRow] = await db
    .select({ total: sql<string>`COALESCE(SUM(${donations.matchAmount}), 0)` })
    .from(donations)
    .where(eq(donations.corporateWorkspaceId, ws.id));
  const matchedYtd = Number(matchedYtdRow.total ?? 0);
  // Total cap across active match policies
  const policies = await db
    .select({ capTotal: matchPolicies.capTotal, status: matchPolicies.status })
    .from(matchPolicies)
    .where(eq(matchPolicies.corporateWorkspaceId, ws.id));
  const totalCap = policies
    .filter((p) => p.status === "active" && p.capTotal !== null)
    .reduce((s, p) => s + Number(p.capTotal), 0) || null;

  // 3. Active partners
  const activePartnerCount = vettedPartners.length;
  const newPartnersThisQuarter = vettedPartners.filter((p) => p.createdAt >= quarterStart).length;

  // ─────────────────────────────────────────────────────────────
  // PENDING REVIEW
  // Currently surfaces:
  //   - Diligence documents in `ready_for_review` (not snoozed)
  //   - Recaps in draft (not snoozed)
  const activeSnoozes = await db
    .select({ targetId: snoozes.targetId })
    .from(snoozes)
    .where(
      and(
        eq(snoozes.workspaceId, ws.id),
        gt(snoozes.snoozedUntil, now),
      ),
    );
  const snoozedTargetIds = new Set(activeSnoozes.map((s) => s.targetId));

  const pendingReview: PendingReviewItem[] = [];

  const readyDiligence = await db
    .select({
      doc: diligenceDocuments,
      partnerName: nonprofitPartners.commonName,
      partnerId: nonprofitPartners.id,
    })
    .from(diligenceDocuments)
    .leftJoin(
      nonprofitPartners,
      eq(diligenceDocuments.partnerId, nonprofitPartners.id),
    )
    .where(
      and(
        eq(diligenceDocuments.workspaceId, ws.id),
        eq(diligenceDocuments.status, "ready_for_review"),
      ),
    );
  for (const r of readyDiligence) {
    if (snoozedTargetIds.has(r.doc.id)) continue;
    pendingReview.push({
      id: r.doc.id,
      kind: "diligence",
      title: `Diligence: ${r.partnerName ?? "Partner"}`,
      reasoning: shortenReasoning(r.doc.narrative ?? ""),
      href: `/partners/${r.partnerId}/diligence`,
      drafted_label: relTimeShort(r.doc.generatedAt),
      concern_level: (r.doc.concernLevel as PendingReviewItem["concern_level"]) ?? null,
      target_id: r.doc.id,
    });
  }

  const draftRecaps = await db
    .select()
    .from(recaps)
    .where(and(eq(recaps.workspaceId, ws.id), eq(recaps.status, "draft")));
  for (const r of draftRecaps) {
    if (snoozedTargetIds.has(r.id)) continue;
    pendingReview.push({
      id: `recap-${r.id}`,
      kind: "recap",
      title: r.title,
      reasoning: r.lede ?? "Recap awaiting your approval",
      href: `/recaps/${r.id}`,
      drafted_label: relTimeShort(r.generatedAt),
      concern_level: null,
      target_id: r.id,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // UPCOMING — activated events in the next 14 days
  const upcomingRows = vettedPartnerIds.length
    ? await db
        .select()
        .from(events)
        .where(
          and(
            inArray(events.partnerId, vettedPartnerIds),
            eq(events.status, "activated"),
            gte(events.startsAt, now),
            lte(events.startsAt, twoWeeksOut),
          ),
        )
        .orderBy(events.startsAt)
        .limit(2)
    : [];
  const upcomingIds = upcomingRows.map((e) => e.id);
  const upcomingSignups = upcomingIds.length
    ? await db
        .select({
          eventId: eventSignups.eventId,
          c: sql<string>`COUNT(*)`,
        })
        .from(eventSignups)
        .where(
          and(
            inArray(eventSignups.eventId, upcomingIds),
            inArray(eventSignups.status, ["registered", "checked_in"]),
          ),
        )
        .groupBy(eventSignups.eventId)
    : [];
  const signupCountByEvent = new Map(upcomingSignups.map((r) => [r.eventId, Number(r.c)]));

  const upcoming: UpcomingItem[] = upcomingRows.map((e) => ({
    id: e.id,
    title: e.title,
    partnerName: partnerNameById.get(e.partnerId ?? "") ?? "Partner",
    startsAt: e.startsAt.toISOString(),
    location: e.location,
    signupRatio: {
      registered: signupCountByEvent.get(e.id) ?? 0,
      capacity: e.confirmedCapacity ?? e.capacity,
    },
    daysUntil: Math.max(0, Math.ceil((e.startsAt.getTime() - now.getTime()) / 86_400_000)),
  }));

  const nextEventSummary = upcoming[0]
    ? { title: upcoming[0].title, days_until: upcoming[0].daysUntil }
    : null;

  // ─────────────────────────────────────────────────────────────
  // ACTIVE CAMPAIGNS — campaigns from vetted partners, status='open'
  const activeCampaignRows = vettedWorkspaceIds.length
    ? await db
        .select()
        .from(donationCampaigns)
        .where(
          and(
            inArray(donationCampaigns.nonprofitWorkspaceId, vettedWorkspaceIds),
            eq(donationCampaigns.status, "open"),
          ),
        )
        .orderBy(donationCampaigns.endsAt)
        .limit(3)
    : [];
  const campaignIds = activeCampaignRows.map((c) => c.id);
  const raisedRows = campaignIds.length
    ? await db
        .select({
          campaign_id: donations.campaignId,
          total: sql<string>`COALESCE(SUM(${donations.amount} + ${donations.matchAmount}), 0)`,
        })
        .from(donations)
        .where(
          and(
            eq(donations.corporateWorkspaceId, ws.id),
            inArray(donations.campaignId, campaignIds),
          ),
        )
        .groupBy(donations.campaignId)
    : [];
  const raisedByCampaign = new Map(raisedRows.map((r) => [r.campaign_id, Number(r.total)]));
  const activeCampaigns: ActiveCampaignItem[] = activeCampaignRows.map((c) => ({
    id: c.id,
    title: c.title,
    partnerName: partnerNameByWorkspaceId.get(c.nonprofitWorkspaceId) ?? "Partner",
    raised: raisedByCampaign.get(c.id) ?? 0,
    goal: Number(c.goalAmount),
    endsAt: c.endsAt.toISOString(),
  }));

  // ─────────────────────────────────────────────────────────────
  // PARTNER ACTIVITY — last 7 days of audit_log on nonprofit workspaces
  let partnerActivity: PartnerActivityItem[] = [];
  if (vettedWorkspaceIds.length) {
    const auditRows = await db
      .select()
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.workspaceId, vettedWorkspaceIds),
          gte(auditLog.at, sevenDaysAgo),
        ),
      )
      .orderBy(desc(auditLog.at))
      .limit(6);
    partnerActivity = auditRows.map((row) => {
      const partnerName = partnerNameByWorkspaceId.get(row.workspaceId) ?? "Partner";
      return {
        id: row.id,
        kind: mapAuditAction(row.action),
        message: formatActivityMessage(row.action, row.payload, partnerName),
        at: row.at.toISOString(),
        partnerName,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // RECENTLY SHIPPED — most recent approved recap + artifact count
  const [latestApprovedRecap] = await db
    .select()
    .from(recaps)
    .where(and(eq(recaps.workspaceId, ws.id), eq(recaps.status, "approved")))
    .orderBy(desc(recaps.approvedAt))
    .limit(1);
  let recentlyShipped: RecentlyShippedRow | null = null;
  if (latestApprovedRecap?.approvedAt) {
    const artifactCount = await db
      .select({ c: sql<string>`COUNT(*)` })
      .from(marketingArtifacts)
      .where(
        and(
          eq(marketingArtifacts.recapId, latestApprovedRecap.id),
          eq(marketingArtifacts.status, "approved"),
        ),
      );
    recentlyShipped = {
      recap_id: latestApprovedRecap.id,
      title: latestApprovedRecap.title,
      artifact_count: Number(artifactCount[0]?.c ?? 0),
      approved_at: latestApprovedRecap.approvedAt.toISOString(),
    };
  }

  const feed: WorkbenchFeed = {
    ambient_stats: {
      quarter_hours: {
        value: Math.round(quarterHours),
        delta_label: hoursDelta === 0 ? "first activity this quarter" : `${hoursDelta >= 0 ? "+" : ""}${hoursDelta}% vs last quarter`,
      },
      matched_ytd: {
        value: Math.round(matchedYtd),
        cap: totalCap,
        delta_label: totalCap
          ? `${Math.round((matchedYtd / totalCap) * 100)}% of $${(totalCap / 1000).toFixed(1)}k cap`
          : "uncapped",
      },
      active_partners: {
        value: activePartnerCount,
        delta_label: newPartnersThisQuarter > 0
          ? `+${newPartnersThisQuarter} this quarter`
          : "no change",
      },
    },
    pending_review: pendingReview,
    upcoming,
    active_campaigns: activeCampaigns,
    partner_activity: partnerActivity,
    recently_shipped: recentlyShipped,
    next_event_summary: nextEventSummary,
  };

  return NextResponse.json(feed);
}

// ─────────────────────────────────────────────────────────────
function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
function addQuarters(d: Date, n: number): Date {
  const copy = new Date(d.getTime());
  copy.setMonth(copy.getMonth() + n * 3);
  return copy;
}
function shortenReasoning(text: string): string {
  const firstSentence = text.split(/(?<=[.!?])\s/)[0];
  if (firstSentence.length > 120) return `${firstSentence.slice(0, 117)}…`;
  return firstSentence;
}
function relTimeShort(at: Date): string {
  const sec = Math.round((Date.now() - at.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  return `${mo} mo ago`;
}

function mapAuditAction(action: string): PartnerActivityItem["kind"] {
  if (action === "event.created") return "event_published";
  if (action === "campaign.created") return "campaign_published";
  if (action === "event.supplies.updated") return "supplies_updated";
  if (action === "event.shared_notes.updated") return "notes_updated";
  if (action.startsWith("recap.")) return "donation_thanks";
  return "event_completed";
}

function formatActivityMessage(
  action: string,
  payload: Record<string, unknown>,
  partnerName: string,
): string {
  const title = (payload?.title as string | undefined) ?? "";
  if (action === "event.created") {
    return `${partnerName} published ${title || "a new event"}`;
  }
  if (action === "campaign.created") {
    return `${partnerName} published ${title || "a new campaign"}`;
  }
  if (action === "event.supplies.updated") {
    return `${partnerName} updated supplies needed`;
  }
  if (action === "event.shared_notes.updated") {
    return `${partnerName} updated shared notes`;
  }
  if (action === "recap.approved") {
    return `${partnerName} sent a thank-you for ${title || "the event"}`;
  }
  return `${partnerName} · ${action}`;
}
