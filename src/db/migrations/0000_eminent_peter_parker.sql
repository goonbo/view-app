CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_kind" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comms_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"body_original" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_by" text DEFAULT 'claude-sonnet-4-6' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "diligence_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ein" text NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"concern_level" text,
	"narrative" text,
	"narrative_original" text,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"things_to_verify" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_by" text DEFAULT 'claude-sonnet-4-6' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "donation_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonprofit_workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"story" text,
	"cause_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"goal_amount" numeric(10, 2) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"ai_brief" text,
	"ai_brief_original" text,
	"ai_brief_approved" boolean DEFAULT false NOT NULL,
	"giving_ladder" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"employee_name" text NOT NULL,
	"employee_email" text NOT NULL,
	"corporate_workspace_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"match_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"match_policy_id" uuid,
	"partner_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"employee_name" text NOT NULL,
	"employee_email" text NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"hours_logged" numeric(5, 2)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonprofit_workspace_id" uuid NOT NULL,
	"partner_id" uuid,
	"corporate_workspace_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"confirmed_capacity" integer,
	"format" text DEFAULT 'onsite' NOT NULL,
	"cause_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_brief" text,
	"ai_brief_original" text,
	"ai_brief_approved" boolean DEFAULT false NOT NULL,
	"shared_notes" text,
	"supplies" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recap_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"content_md" text NOT NULL,
	"content_md_original" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corporate_workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"eligible_partner_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_ratio" numeric(3, 2) NOT NULL,
	"cap_per_employee" numeric(10, 2) NOT NULL,
	"cap_total" numeric(12, 2),
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nonprofit_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"corporate_workspace_id" uuid NOT NULL,
	"nonprofit_workspace_id" uuid,
	"ein" text NOT NULL,
	"legal_name" text NOT NULL,
	"common_name" text NOT NULL,
	"mission" text,
	"location" text,
	"website" text,
	"cause_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"match_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"scope_target_id" uuid,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"lede" text,
	"narrative_md" text,
	"narrative_md_original" text,
	"by_the_numbers" jsonb DEFAULT '{}'::jsonb,
	"outcomes" jsonb DEFAULT '[]'::jsonb,
	"recommendations" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "snoozes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"snoozed_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"accent" text NOT NULL,
	"ein" text,
	"cause_areas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comms_drafts" ADD CONSTRAINT "comms_drafts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_documents" ADD CONSTRAINT "diligence_documents_partner_id_nonprofit_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."nonprofit_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_documents" ADD CONSTRAINT "diligence_documents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diligence_documents" ADD CONSTRAINT "diligence_documents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_campaigns" ADD CONSTRAINT "donation_campaigns_nonprofit_workspace_id_workspaces_id_fk" FOREIGN KEY ("nonprofit_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_donation_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."donation_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_corporate_workspace_id_workspaces_id_fk" FOREIGN KEY ("corporate_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_match_policy_id_match_policies_id_fk" FOREIGN KEY ("match_policy_id") REFERENCES "public"."match_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_partner_id_nonprofit_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."nonprofit_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_signups" ADD CONSTRAINT "event_signups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_nonprofit_workspace_id_workspaces_id_fk" FOREIGN KEY ("nonprofit_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_partner_id_nonprofit_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."nonprofit_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_corporate_workspace_id_workspaces_id_fk" FOREIGN KEY ("corporate_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_artifacts" ADD CONSTRAINT "marketing_artifacts_recap_id_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."recaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_policies" ADD CONSTRAINT "match_policies_corporate_workspace_id_workspaces_id_fk" FOREIGN KEY ("corporate_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_partners" ADD CONSTRAINT "nonprofit_partners_corporate_workspace_id_workspaces_id_fk" FOREIGN KEY ("corporate_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_partners" ADD CONSTRAINT "nonprofit_partners_nonprofit_workspace_id_workspaces_id_fk" FOREIGN KEY ("nonprofit_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recaps" ADD CONSTRAINT "recaps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snoozes" ADD CONSTRAINT "snoozes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snoozes" ADD CONSTRAINT "snoozes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;