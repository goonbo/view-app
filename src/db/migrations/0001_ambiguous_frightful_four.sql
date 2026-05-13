CREATE TABLE "nonprofit_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recap_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'drafting' NOT NULL,
	"body" text NOT NULL,
	"body_original" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nonprofit_event_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"nonprofit_workspace_id" uuid NOT NULL,
	"signup_count" integer DEFAULT 0 NOT NULL,
	"checked_in_count" integer DEFAULT 0 NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"total_hours" integer DEFAULT 0 NOT NULL,
	"satisfaction_avg" numeric(3, 2),
	"satisfaction_response_rate" numeric(4, 3),
	"retention_followup_count" integer DEFAULT 0 NOT NULL,
	"no_show_analysis_md" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nonprofit_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonprofit_workspace_id" uuid NOT NULL,
	"period" text NOT NULL,
	"status" text DEFAULT 'drafting' NOT NULL,
	"opening_para" text,
	"partner_contributions" jsonb DEFAULT '[]'::jsonb,
	"what_worked" text,
	"what_drifted" text,
	"ask_for_next_quarter" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nonprofit_volunteer_overlay" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonprofit_workspace_id" uuid NOT NULL,
	"employee_email" text NOT NULL,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capacity_signal" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nonprofit_artifacts" ADD CONSTRAINT "nonprofit_artifacts_recap_id_nonprofit_recaps_id_fk" FOREIGN KEY ("recap_id") REFERENCES "public"."nonprofit_recaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_artifacts" ADD CONSTRAINT "nonprofit_artifacts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_event_stats" ADD CONSTRAINT "nonprofit_event_stats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_event_stats" ADD CONSTRAINT "nonprofit_event_stats_nonprofit_workspace_id_workspaces_id_fk" FOREIGN KEY ("nonprofit_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_recaps" ADD CONSTRAINT "nonprofit_recaps_nonprofit_workspace_id_workspaces_id_fk" FOREIGN KEY ("nonprofit_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_recaps" ADD CONSTRAINT "nonprofit_recaps_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nonprofit_volunteer_overlay" ADD CONSTRAINT "nonprofit_volunteer_overlay_nonprofit_workspace_id_workspaces_id_fk" FOREIGN KEY ("nonprofit_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;