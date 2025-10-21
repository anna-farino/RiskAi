ALTER POLICY "rls-threat-keywords" ON "threat_keywords" TO public USING ((
  user_id::text = current_setting('app.current_user_id', true)
  OR is_default = true
  OR true
)) WITH CHECK ((
  user_id::text = current_setting('app.current_user_id', true)
  OR true
));
