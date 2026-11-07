CREATE TABLE "shulk_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"challan_no" text NOT NULL,
	"challan_date" date NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shulk_returns" ADD CONSTRAINT "shulk_returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;