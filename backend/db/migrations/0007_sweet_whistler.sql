CREATE TYPE "public"."secretType" AS ENUM('test');--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "secrets" ALTER COLUMN "type" SET DATA TYPE "public"."secretType" USING "type"::text::"public"."secretType";--> statement-breakpoint
CREATE POLICY "roles_read_policy" ON "roles" AS PERMISSIVE FOR SELECT TO public USING ('roles:view' = 
  ANY(
    coalesce(
      (current_setting('app.current_user_permissions',true))::text[],
      '{}'::text[]
    )
  )
);--> statement-breakpoint
DROP TYPE "public"."role";
