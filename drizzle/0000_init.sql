CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "account_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_hi" text NOT NULL,
	"name_en" text NOT NULL,
	"nature" text NOT NULL,
	"parent_id" integer,
	CONSTRAINT "account_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text,
	"group_id" integer NOT NULL,
	"party_type" text NOT NULL,
	"name_hi" text DEFAULT '' NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"father_name" text DEFAULT '' NOT NULL,
	"village" text DEFAULT '' NOT NULL,
	"tehsil" text DEFAULT '' NOT NULL,
	"mobile" text DEFAULT '' NOT NULL,
	"pan" text DEFAULT '' NOT NULL,
	"aadhaar_last4" text DEFAULT '' NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"bank_ac" text DEFAULT '' NOT NULL,
	"ifsc" text DEFAULT '' NOT NULL,
	"gstin" text DEFAULT '' NOT NULL,
	"licence_no" text DEFAULT '' NOT NULL,
	"opening_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"opening_side" text DEFAULT 'jama' NOT NULL,
	"credit_days" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "arrivals" (
	"id" serial PRIMARY KEY NOT NULL,
	"arrival_no" integer NOT NULL,
	"fy_id" integer NOT NULL,
	"date" date NOT NULL,
	"kisan_id" integer NOT NULL,
	"gate_entry_no" text DEFAULT '' NOT NULL,
	"vehicle_no" text DEFAULT '' NOT NULL,
	"remarks" text DEFAULT '' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"row_id" text NOT NULL,
	"action" text NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"reason" text,
	"user_id" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"file" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"user_id" integer
);
--> statement-breakpoint
CREATE TABLE "bill_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_voucher_id" integer NOT NULL,
	"bill_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"lot_sale_id" integer NOT NULL,
	"commodity_id" integer NOT NULL,
	"kisan_id" integer,
	"bags" integer NOT NULL,
	"net_kg" numeric(12, 2) NOT NULL,
	"bhav" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_no" integer NOT NULL,
	"fy_id" integer NOT NULL,
	"date" date NOT NULL,
	"vyapari_id" integer NOT NULL,
	"sale_type" text DEFAULT 'private' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"charges" numeric(14, 2) NOT NULL,
	"round_off" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"print_count" integer DEFAULT 0 NOT NULL,
	"voucher_id" integer,
	"radd_reason" text,
	"radd_by" integer,
	"radd_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_counts" (
	"date" date PRIMARY KEY NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"counted_by" integer,
	"counted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charge_heads" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_hi" text NOT NULL,
	"name_en" text NOT NULL,
	"kind" text DEFAULT 'kharcha' NOT NULL,
	"basis" text NOT NULL,
	"ref_head_id" integer,
	"payer" text NOT NULL,
	"split_kisan_pct" numeric(10, 4) DEFAULT '50' NOT NULL,
	"sale_type" text DEFAULT 'private' NOT NULL,
	"allow_party_override" boolean DEFAULT true NOT NULL,
	"post_mode" text DEFAULT 'income' NOT NULL,
	"post_account_id" integer,
	"seq" integer DEFAULT 0 NOT NULL,
	"rounding" text DEFAULT 'none' NOT NULL,
	"on_parchi" boolean DEFAULT true NOT NULL,
	"on_bill" boolean DEFAULT true NOT NULL,
	"print_label_hi" text DEFAULT '' NOT NULL,
	"print_label_en" text DEFAULT '' NOT NULL,
	"active_from" date NOT NULL,
	"active_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_heads_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "charge_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"charge_head_id" integer NOT NULL,
	"commodity_id" integer,
	"account_id" integer,
	"rate" numeric(10, 4) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commodities" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_hi" text NOT NULL,
	"name_en" text NOT NULL,
	"hsn" text DEFAULT '' NOT NULL,
	"unit" text DEFAULT 'qtl' NOT NULL,
	"fee_group" text DEFAULT 'A' NOT NULL,
	"bag_kg" numeric(12, 2) DEFAULT '50' NOT NULL,
	"default_tare_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"default_moisture_pct" numeric(10, 4) DEFAULT '0' NOT NULL,
	"weigh_mode" text DEFAULT 'total' NOT NULL,
	"msp_rate" numeric(14, 2),
	"msp_season" text DEFAULT '' NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "commodities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "custom_labels" (
	"key" text PRIMARY KEY NOT NULL,
	"text_hi" text DEFAULT '' NOT NULL,
	"text_en" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_closes" (
	"date" date PRIMARY KEY NOT NULL,
	"is_closed" boolean DEFAULT true NOT NULL,
	"closed_by" integer,
	"closed_at" timestamp with time zone,
	"reopened_by" integer,
	"reopened_at" timestamp with time zone,
	"reopen_reason" text
);
--> statement-breakpoint
CREATE TABLE "document_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_type" text NOT NULL,
	"doc_id" integer NOT NULL,
	"charge_head_id" integer NOT NULL,
	"code" text NOT NULL,
	"name_hi" text NOT NULL,
	"name_en" text NOT NULL,
	"basis" text NOT NULL,
	"basis_value" numeric(16, 4) NOT NULL,
	"rate_used" numeric(10, 4),
	"full_amount" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payer" text NOT NULL,
	"post_mode" text NOT NULL,
	"post_account_id" integer,
	"printed" boolean DEFAULT true NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "financial_years_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "firm_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name_hi" text DEFAULT '' NOT NULL,
	"name_en" text DEFAULT '' NOT NULL,
	"licence_no" text DEFAULT '' NOT NULL,
	"address_hi" text DEFAULT '' NOT NULL,
	"address_en" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"pan" text DEFAULT '' NOT NULL,
	"gstin" text DEFAULT '' NOT NULL,
	"logo" text,
	"footer_text" text DEFAULT '' NOT NULL,
	"default_lang" text DEFAULT 'both' NOT NULL,
	"parchi_mode" text DEFAULT 'per_day' NOT NULL,
	"bill_mode" text DEFAULT 'per_day' NOT NULL,
	"parchi_layout" text DEFAULT 'full' NOT NULL,
	"total_rounding" text DEFAULT 'nearest_1' NOT NULL,
	"bhav_warn_pct" numeric(10, 4) DEFAULT '15' NOT NULL,
	"cash_limit" numeric(14, 2) DEFAULT '10000' NOT NULL,
	"byaj_days_in_month" integer DEFAULT 30 NOT NULL,
	"sarkari_credit_kisan" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"product" numeric(20, 2) NOT NULL,
	"rate" numeric(10, 4) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"voucher_id" integer
);
--> statement-breakpoint
CREATE TABLE "interest_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"rate_pm" numeric(10, 4) NOT NULL,
	"method" text DEFAULT 'simple' NOT NULL,
	"grace_days" integer DEFAULT 0 NOT NULL,
	"overdue_only" boolean DEFAULT false NOT NULL,
	"effective_from" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"date" date NOT NULL,
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"narration" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lot_bag_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_sale_id" integer NOT NULL,
	"bag_no" integer NOT NULL,
	"kg" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lot_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"lot_id" integer NOT NULL,
	"vyapari_id" integer,
	"sale_type" text DEFAULT 'private' NOT NULL,
	"bhav" numeric(14, 2),
	"bags" integer DEFAULT 0 NOT NULL,
	"weigh_mode" text DEFAULT 'total' NOT NULL,
	"gross_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tare_per_bag_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tare_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"moisture_pct" numeric(10, 4) DEFAULT '0' NOT NULL,
	"moisture_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"dust_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"net_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"value_cut" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"boli_at" timestamp with time zone,
	"tulai_at" timestamp with time zone,
	"parchi_id" integer,
	"bill_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"arrival_id" integer NOT NULL,
	"kisan_id" integer NOT NULL,
	"commodity_id" integer NOT NULL,
	"date" date NOT NULL,
	"bags" integer DEFAULT 0 NOT NULL,
	"quality_note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'aamad' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_series" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_type" text NOT NULL,
	"fy_id" integer NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"next_no" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parchi_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"parchi_id" integer NOT NULL,
	"lot_sale_id" integer NOT NULL,
	"commodity_id" integer NOT NULL,
	"vyapari_id" integer,
	"bags" integer NOT NULL,
	"net_kg" numeric(12, 2) NOT NULL,
	"bhav" numeric(14, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parchis" (
	"id" serial PRIMARY KEY NOT NULL,
	"parchi_no" integer NOT NULL,
	"fy_id" integer NOT NULL,
	"date" date NOT NULL,
	"kisan_id" integer NOT NULL,
	"sale_type" text DEFAULT 'private' NOT NULL,
	"gross_amount" numeric(14, 2) NOT NULL,
	"deductions" numeric(14, 2) NOT NULL,
	"round_off" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(14, 2) NOT NULL,
	"peshgi_recovered" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payable_amount" numeric(14, 2) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"print_count" integer DEFAULT 0 NOT NULL,
	"voucher_id" integer,
	"radd_reason" text,
	"radd_by" integer,
	"radd_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tds_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"voucher_id" integer NOT NULL,
	"vyapari_id" integer NOT NULL,
	"section" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"quarter" text NOT NULL,
	"fy_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mobile" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"lang" text DEFAULT 'hi' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"voucher_no" integer NOT NULL,
	"fy_id" integer NOT NULL,
	"date" date NOT NULL,
	"narration" text DEFAULT '' NOT NULL,
	"mode" text DEFAULT 'journal' NOT NULL,
	"ref_no" text DEFAULT '' NOT NULL,
	"bank_account_id" integer,
	"party_id" integer,
	"amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reverses_id" integer,
	"doc_type" text,
	"doc_id" integer,
	"print_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_parent_id_account_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."account_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_group_id_account_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."account_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrivals" ADD CONSTRAINT "arrivals_fy_id_financial_years_id_fk" FOREIGN KEY ("fy_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrivals" ADD CONSTRAINT "arrivals_kisan_id_accounts_id_fk" FOREIGN KEY ("kisan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrivals" ADD CONSTRAINT "arrivals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups_log" ADD CONSTRAINT "backups_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_allocations" ADD CONSTRAINT "bill_allocations_receipt_voucher_id_vouchers_id_fk" FOREIGN KEY ("receipt_voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_allocations" ADD CONSTRAINT "bill_allocations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_lot_sale_id_lot_sales_id_fk" FOREIGN KEY ("lot_sale_id") REFERENCES "public"."lot_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_kisan_id_accounts_id_fk" FOREIGN KEY ("kisan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_fy_id_financial_years_id_fk" FOREIGN KEY ("fy_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vyapari_id_accounts_id_fk" FOREIGN KEY ("vyapari_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_radd_by_users_id_fk" FOREIGN KEY ("radd_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_counted_by_users_id_fk" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_heads" ADD CONSTRAINT "charge_heads_ref_head_id_charge_heads_id_fk" FOREIGN KEY ("ref_head_id") REFERENCES "public"."charge_heads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_heads" ADD CONSTRAINT "charge_heads_post_account_id_accounts_id_fk" FOREIGN KEY ("post_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_rates" ADD CONSTRAINT "charge_rates_charge_head_id_charge_heads_id_fk" FOREIGN KEY ("charge_head_id") REFERENCES "public"."charge_heads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_rates" ADD CONSTRAINT "charge_rates_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_rates" ADD CONSTRAINT "charge_rates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_rates" ADD CONSTRAINT "charge_rates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_closes" ADD CONSTRAINT "day_closes_reopened_by_users_id_fk" FOREIGN KEY ("reopened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_charges" ADD CONSTRAINT "document_charges_charge_head_id_charge_heads_id_fk" FOREIGN KEY ("charge_head_id") REFERENCES "public"."charge_heads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_charges" ADD CONSTRAINT "document_charges_post_account_id_accounts_id_fk" FOREIGN KEY ("post_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_lines" ADD CONSTRAINT "interest_lines_run_id_interest_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."interest_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_lines" ADD CONSTRAINT "interest_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_lines" ADD CONSTRAINT "interest_lines_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_rules" ADD CONSTRAINT "interest_rules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_runs" ADD CONSTRAINT "interest_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_bag_weights" ADD CONSTRAINT "lot_bag_weights_lot_sale_id_lot_sales_id_fk" FOREIGN KEY ("lot_sale_id") REFERENCES "public"."lot_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_sales" ADD CONSTRAINT "lot_sales_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lot_sales" ADD CONSTRAINT "lot_sales_vyapari_id_accounts_id_fk" FOREIGN KEY ("vyapari_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_arrival_id_arrivals_id_fk" FOREIGN KEY ("arrival_id") REFERENCES "public"."arrivals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_kisan_id_accounts_id_fk" FOREIGN KEY ("kisan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_series" ADD CONSTRAINT "number_series_fy_id_financial_years_id_fk" FOREIGN KEY ("fy_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchi_lines" ADD CONSTRAINT "parchi_lines_parchi_id_parchis_id_fk" FOREIGN KEY ("parchi_id") REFERENCES "public"."parchis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchi_lines" ADD CONSTRAINT "parchi_lines_lot_sale_id_lot_sales_id_fk" FOREIGN KEY ("lot_sale_id") REFERENCES "public"."lot_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchi_lines" ADD CONSTRAINT "parchi_lines_commodity_id_commodities_id_fk" FOREIGN KEY ("commodity_id") REFERENCES "public"."commodities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchi_lines" ADD CONSTRAINT "parchi_lines_vyapari_id_accounts_id_fk" FOREIGN KEY ("vyapari_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchis" ADD CONSTRAINT "parchis_fy_id_financial_years_id_fk" FOREIGN KEY ("fy_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchis" ADD CONSTRAINT "parchis_kisan_id_accounts_id_fk" FOREIGN KEY ("kisan_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchis" ADD CONSTRAINT "parchis_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchis" ADD CONSTRAINT "parchis_radd_by_users_id_fk" FOREIGN KEY ("radd_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parchis" ADD CONSTRAINT "parchis_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_entries" ADD CONSTRAINT "tds_entries_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_entries" ADD CONSTRAINT "tds_entries_vyapari_id_accounts_id_fk" FOREIGN KEY ("vyapari_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_entries" ADD CONSTRAINT "tds_entries_fy_id_financial_years_id_fk" FOREIGN KEY ("fy_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_fy_id_financial_years_id_fk" FOREIGN KEY ("fy_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_bank_account_id_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_party_id_accounts_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reverses_id_vouchers_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_party_type_idx" ON "accounts" USING btree ("party_type");--> statement-breakpoint
CREATE INDEX "accounts_name_hi_trgm" ON "accounts" USING gin ("name_hi" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "accounts_name_en_trgm" ON "accounts" USING gin ("name_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "accounts_village_trgm" ON "accounts" USING gin ("village" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_mobile_per_type" ON "accounts" USING btree ("party_type","mobile") WHERE "accounts"."mobile" <> '';--> statement-breakpoint
CREATE INDEX "arrivals_date_idx" ON "arrivals" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "arrivals_no_fy" ON "arrivals" USING btree ("fy_id","arrival_no");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_no_fy" ON "bills" USING btree ("fy_id","bill_no");--> statement-breakpoint
CREATE INDEX "bills_date_idx" ON "bills" USING btree ("date");--> statement-breakpoint
CREATE INDEX "charge_rates_head_idx" ON "charge_rates" USING btree ("charge_head_id","effective_from");--> statement-breakpoint
CREATE INDEX "document_charges_doc_idx" ON "document_charges" USING btree ("doc_type","doc_id");--> statement-breakpoint
CREATE INDEX "ledger_account_date_idx" ON "ledger_entries" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "ledger_voucher_idx" ON "ledger_entries" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "lot_sales_lot_idx" ON "lot_sales" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "lot_sales_vyapari_idx" ON "lot_sales" USING btree ("vyapari_id");--> statement-breakpoint
CREATE INDEX "lots_date_idx" ON "lots" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "number_series_doc_fy" ON "number_series" USING btree ("doc_type","fy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parchis_no_fy" ON "parchis" USING btree ("fy_id","parchi_no");--> statement-breakpoint
CREATE INDEX "parchis_date_idx" ON "parchis" USING btree ("date");--> statement-breakpoint
CREATE INDEX "vouchers_date_idx" ON "vouchers" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_type_no_fy" ON "vouchers" USING btree ("type","fy_id","voucher_no");