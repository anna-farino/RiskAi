CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"type" text,
	"industry" text,
	"description" text,
	"website" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid,
	"discovered_from" uuid,
	"is_verified" boolean DEFAULT false,
	"metadata" jsonb,
	CONSTRAINT "companies_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "hardware" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"model" text,
	"manufacturer" text,
	"category" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid,
	"discovered_from" uuid,
	"is_verified" boolean DEFAULT false,
	"metadata" jsonb,
	CONSTRAINT "hardware_normalized_name_model_manufacturer_unique" UNIQUE("normalized_name","model","manufacturer")
);
--> statement-breakpoint
CREATE TABLE "software" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"company_id" uuid,
	"category" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"created_by" uuid,
	"discovered_from" uuid,
	"is_verified" boolean DEFAULT false,
	"metadata" jsonb,
	CONSTRAINT "software_normalized_name_company_id_unique" UNIQUE("normalized_name","company_id")
);
--> statement-breakpoint
CREATE TABLE "threat_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"aliases" text[],
	"type" text,
	"origin" text,
	"first_seen" timestamp,
	"description" text,
	"tactics" text[],
	"targets" text[],
	"created_at" timestamp DEFAULT now(),
	"discovered_from" uuid,
	"is_verified" boolean DEFAULT false,
	"metadata" jsonb,
	CONSTRAINT "threat_actors_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "article_companies" (
	"article_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"mention_type" text,
	"confidence" numeric(3, 2),
	"context" text,
	"extracted_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "article_companies_article_id_company_id_pk" PRIMARY KEY("article_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "article_cves" (
	"article_id" uuid NOT NULL,
	"cve_id" text NOT NULL,
	"confidence" numeric(3, 2),
	"context" text,
	"extracted_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "article_cves_article_id_cve_id_pk" PRIMARY KEY("article_id","cve_id")
);
--> statement-breakpoint
CREATE TABLE "article_hardware" (
	"article_id" uuid NOT NULL,
	"hardware_id" uuid NOT NULL,
	"confidence" numeric(3, 2),
	"context" text,
	"extracted_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "article_hardware_article_id_hardware_id_pk" PRIMARY KEY("article_id","hardware_id")
);
--> statement-breakpoint
CREATE TABLE "article_software" (
	"article_id" uuid NOT NULL,
	"software_id" uuid NOT NULL,
	"version_from" text,
	"version_to" text,
	"confidence" numeric(3, 2),
	"context" text,
	"extracted_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "article_software_article_id_software_id_pk" PRIMARY KEY("article_id","software_id")
);
--> statement-breakpoint
CREATE TABLE "article_threat_actors" (
	"article_id" uuid NOT NULL,
	"threat_actor_id" uuid NOT NULL,
	"confidence" numeric(3, 2),
	"context" text,
	"activity_type" text,
	"extracted_at" timestamp DEFAULT now(),
	"metadata" jsonb,
	CONSTRAINT "article_threat_actors_article_id_threat_actor_id_pk" PRIMARY KEY("article_id","threat_actor_id")
);
--> statement-breakpoint
CREATE TABLE "entity_resolution_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"resolved_id" text,
	"canonical_name" text NOT NULL,
	"confidence" real NOT NULL,
	"aliases" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"reasoning" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_relevance_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relevance_score" numeric(4, 2),
	"software_score" numeric(4, 2),
	"client_score" numeric(4, 2),
	"vendor_score" numeric(4, 2),
	"hardware_score" numeric(4, 2),
	"keyword_score" numeric(4, 2),
	"matched_software" text[],
	"matched_companies" text[],
	"matched_hardware" text[],
	"matched_keywords" text[],
	"calculated_at" timestamp DEFAULT now(),
	"calculation_version" text DEFAULT '1.0',
	"metadata" jsonb,
	CONSTRAINT "article_relevance_scores_article_id_user_id_unique" UNIQUE("article_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "users_companies" (
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"relationship_type" text,
	"added_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 50,
	"metadata" jsonb,
	CONSTRAINT "users_companies_user_id_company_id_pk" PRIMARY KEY("user_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "users_hardware" (
	"user_id" uuid NOT NULL,
	"hardware_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 50,
	"quantity" integer DEFAULT 1,
	"metadata" jsonb,
	CONSTRAINT "users_hardware_user_id_hardware_id_pk" PRIMARY KEY("user_id","hardware_id")
);
--> statement-breakpoint
CREATE TABLE "users_software" (
	"user_id" uuid NOT NULL,
	"software_id" uuid NOT NULL,
	"version" text,
	"added_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 50,
	"metadata" jsonb,
	CONSTRAINT "users_software_user_id_software_id_pk" PRIMARY KEY("user_id","software_id")
);
--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "threat_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "threat_severity_score" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "threat_level" text;--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "attack_vectors" text[];--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "last_threat_analysis" timestamp;--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "threat_analysis_version" text;--> statement-breakpoint
ALTER TABLE "global_articles" ADD COLUMN "entities_extracted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "software" ADD CONSTRAINT "software_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_companies" ADD CONSTRAINT "article_companies_article_id_global_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."global_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_companies" ADD CONSTRAINT "article_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_cves" ADD CONSTRAINT "article_cves_article_id_global_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."global_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_hardware" ADD CONSTRAINT "article_hardware_article_id_global_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."global_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_hardware" ADD CONSTRAINT "article_hardware_hardware_id_hardware_id_fk" FOREIGN KEY ("hardware_id") REFERENCES "public"."hardware"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_software" ADD CONSTRAINT "article_software_article_id_global_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."global_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_software" ADD CONSTRAINT "article_software_software_id_software_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."software"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_threat_actors" ADD CONSTRAINT "article_threat_actors_article_id_global_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."global_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_threat_actors" ADD CONSTRAINT "article_threat_actors_threat_actor_id_threat_actors_id_fk" FOREIGN KEY ("threat_actor_id") REFERENCES "public"."threat_actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_relevance_scores" ADD CONSTRAINT "article_relevance_scores_article_id_global_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."global_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_relevance_scores" ADD CONSTRAINT "article_relevance_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_companies" ADD CONSTRAINT "users_companies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_companies" ADD CONSTRAINT "users_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_hardware" ADD CONSTRAINT "users_hardware_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_hardware" ADD CONSTRAINT "users_hardware_hardware_id_hardware_id_fk" FOREIGN KEY ("hardware_id") REFERENCES "public"."hardware"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_software" ADD CONSTRAINT "users_software_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_software" ADD CONSTRAINT "users_software_software_id_software_id_fk" FOREIGN KEY ("software_id") REFERENCES "public"."software"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_normalized_idx" ON "companies" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_companies_name" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "hardware_normalized_idx" ON "hardware" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "software_normalized_idx" ON "software" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_software_name" ON "software" USING btree ("name");--> statement-breakpoint
CREATE INDEX "threat_actors_normalized_idx" ON "threat_actors" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_threat_actors_name" ON "threat_actors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_threat_actors_aliases" ON "threat_actors" USING btree ("aliases");--> statement-breakpoint
CREATE INDEX "idx_article_companies_article" ON "article_companies" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_companies_company" ON "article_companies" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_article_hardware_article" ON "article_hardware" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_hardware_hardware" ON "article_hardware" USING btree ("hardware_id");--> statement-breakpoint
CREATE INDEX "idx_article_software_article" ON "article_software" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_software_software" ON "article_software" USING btree ("software_id");--> statement-breakpoint
CREATE INDEX "idx_article_threat_actors_article" ON "article_threat_actors" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_threat_actors_actor" ON "article_threat_actors" USING btree ("threat_actor_id");--> statement-breakpoint
CREATE INDEX "entity_resolution_lookup_idx" ON "entity_resolution_cache" USING btree ("input_name","entity_type");--> statement-breakpoint
CREATE INDEX "entity_resolution_expiry_idx" ON "entity_resolution_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_relevance_user_article" ON "article_relevance_scores" USING btree ("user_id","article_id");--> statement-breakpoint
CREATE INDEX "idx_relevance_article_score" ON "article_relevance_scores" USING btree ("article_id","relevance_score");--> statement-breakpoint
CREATE INDEX "idx_relevance_user_score" ON "article_relevance_scores" USING btree ("user_id","relevance_score");--> statement-breakpoint
CREATE INDEX "article_date_idx" ON "article_relevance_scores" USING btree ("article_id","calculated_at");--> statement-breakpoint
CREATE INDEX "idx_users_companies_user" ON "users_companies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_hardware_user" ON "users_hardware" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_software_user" ON "users_software" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_articles_severity" ON "global_articles" USING btree ("threat_severity_score");--> statement-breakpoint
CREATE INDEX "idx_articles_threat_level" ON "global_articles" USING btree ("threat_level");