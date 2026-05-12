import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  numeric,
  uuid,
} from "drizzle-orm/pg-core";

const now = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updated = () => timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  accent: text("accent").notNull(),
  ein: text("ein"),
  causeAreas: jsonb("cause_areas").$type<string[]>().notNull().default([]),
  size: integer("size"),
  createdAt: now(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email").notNull(),
});

export const nonprofitPartners = pgTable("nonprofit_partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  corporateWorkspaceId: uuid("corporate_workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  nonprofitWorkspaceId: uuid("nonprofit_workspace_id").references(() => workspaces.id),
  ein: text("ein").notNull(),
  legalName: text("legal_name").notNull(),
  commonName: text("common_name").notNull(),
  mission: text("mission"),
  location: text("location"),
  website: text("website"),
  causeAreas: jsonb("cause_areas").$type<string[]>().notNull().default([]),
  status: text("status").notNull().default("draft"),
  matchEligible: boolean("match_eligible").notNull().default(false),
  createdAt: now(),
  updatedAt: updated(),
});

export const diligenceDocuments = pgTable("diligence_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => nonprofitPartners.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  ein: text("ein").notNull(),
  status: text("status").notNull().default("generating"),
  concernLevel: text("concern_level"),
  narrative: text("narrative"),
  narrativeOriginal: text("narrative_original"),
  signals: jsonb("signals").$type<Record<string, unknown>>().notNull().default({}),
  thingsToVerify: jsonb("things_to_verify").$type<string[]>().notNull().default([]),
  generatedBy: text("generated_by").notNull().default("claude-sonnet-4-6"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
});

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  nonprofitWorkspaceId: uuid("nonprofit_workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id").references(() => nonprofitPartners.id),
  corporateWorkspaceId: uuid("corporate_workspace_id").references(() => workspaces.id),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  capacity: integer("capacity").notNull(),
  confirmedCapacity: integer("confirmed_capacity"),
  format: text("format").notNull().default("onsite"),
  causeAreas: jsonb("cause_areas").$type<string[]>().notNull().default([]),
  aiBrief: text("ai_brief"),
  aiBriefOriginal: text("ai_brief_original"),
  aiBriefApproved: boolean("ai_brief_approved").notNull().default(false),
  sharedNotes: text("shared_notes"),
  supplies: jsonb("supplies").$type<string[]>().default([]),
  status: text("status").notNull().default("draft"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt: now(),
  updatedAt: updated(),
});

export const eventSignups = pgTable("event_signups", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  status: text("status").notNull().default("registered"),
  hoursLogged: numeric("hours_logged", { precision: 5, scale: 2 }),
});

export const commsDrafts = pgTable("comms_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  bodyOriginal: text("body_original"),
  status: text("status").notNull().default("draft"),
  generatedBy: text("generated_by").notNull().default("claude-sonnet-4-6"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const donationCampaigns = pgTable("donation_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  nonprofitWorkspaceId: uuid("nonprofit_workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  story: text("story"),
  causeAreas: jsonb("cause_areas").$type<string[]>().notNull().default([]),
  goalAmount: numeric("goal_amount", { precision: 10, scale: 2 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  aiBrief: text("ai_brief"),
  aiBriefOriginal: text("ai_brief_original"),
  aiBriefApproved: boolean("ai_brief_approved").notNull().default(false),
  givingLadder: jsonb("giving_ladder").$type<{ amount: number; description: string }[]>().default([]),
  status: text("status").notNull().default("draft"),
  createdAt: now(),
  updatedAt: updated(),
});

export const matchPolicies = pgTable("match_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  corporateWorkspaceId: uuid("corporate_workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  eligiblePartnerIds: jsonb("eligible_partner_ids").$type<string[]>().notNull().default([]),
  matchRatio: numeric("match_ratio", { precision: 3, scale: 2 }).notNull(),
  capPerEmployee: numeric("cap_per_employee", { precision: 10, scale: 2 }).notNull(),
  capTotal: numeric("cap_total", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: now(),
  updatedAt: updated(),
});

export const donations = pgTable("donations", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => donationCampaigns.id, { onDelete: "cascade" }),
  employeeName: text("employee_name").notNull(),
  employeeEmail: text("employee_email").notNull(),
  corporateWorkspaceId: uuid("corporate_workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  matchAmount: numeric("match_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  matchPolicyId: uuid("match_policy_id").references(() => matchPolicies.id),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => nonprofitPartners.id),
  status: text("status").notNull().default("pending"),
  createdAt: now(),
});

export const recaps = pgTable("recaps", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  scopeTargetId: uuid("scope_target_id"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  title: text("title").notNull(),
  lede: text("lede"),
  narrativeMd: text("narrative_md"),
  narrativeMdOriginal: text("narrative_md_original"),
  byTheNumbers: jsonb("by_the_numbers").$type<Record<string, string | number>>().default({}),
  outcomes: jsonb("outcomes").$type<{ headline: string; body: string }[]>().default([]),
  recommendations: jsonb("recommendations").$type<{ headline: string; body: string }[]>().default([]),
  status: text("status").notNull().default("draft"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const marketingArtifacts = pgTable("marketing_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  recapId: uuid("recap_id")
    .notNull()
    .references(() => recaps.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  contentMd: text("content_md").notNull(),
  contentMdOriginal: text("content_md_original"),
  status: text("status").notNull().default("draft"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const snoozes = pgTable("snoozes", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  snoozedUntil: timestamp("snoozed_until", { withTimezone: true }).notNull(),
  createdAt: now(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id"),
  actorKind: text("actor_kind").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type NonprofitPartner = typeof nonprofitPartners.$inferSelect;
export type DiligenceDocument = typeof diligenceDocuments.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventSignup = typeof eventSignups.$inferSelect;
export type CommsDraft = typeof commsDrafts.$inferSelect;
export type DonationCampaign = typeof donationCampaigns.$inferSelect;
export type MatchPolicy = typeof matchPolicies.$inferSelect;
export type Donation = typeof donations.$inferSelect;
export type Recap = typeof recaps.$inferSelect;
export type MarketingArtifact = typeof marketingArtifacts.$inferSelect;
export type Snooze = typeof snoozes.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
