CREATE TABLE "capsule_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"threat_name" text NOT NULL,
	"vulnerability_id" text DEFAULT 'Unspecified' NOT NULL,
	"summary" text NOT NULL,
	"impacts" text NOT NULL,
	"attack_vector" text DEFAULT 'Unknown attack vector' NOT NULL,
	"microsoft_connection" text NOT NULL,
	"source_publication" text NOT NULL,
	"original_url" text NOT NULL,
	"target_os" text DEFAULT 'Microsoft / Windows' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"marked_for_reporting" boolean DEFAULT true NOT NULL,
	"marked_for_deletion" boolean DEFAULT false NOT NULL
);
