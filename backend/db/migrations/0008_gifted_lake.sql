ALTER POLICY "roles_read_policy" ON "roles" TO public USING ('roles:view' = ANY(
        coalesce(
          (current_setting('app.current_user_permissions',true))::text[],
          '{}'::text[]
        )));