-- Custom SQL migration file, put your code below! --
-- 1) Enable RLS (this is idempotent — enabling twice doesn’t fail)
ALTER TABLE articles
  ENABLE ROW LEVEL SECURITY;

-- 2) INSERT policy
DROP POLICY IF EXISTS articles_insert_policy ON articles;
CREATE POLICY articles_insert_policy
  ON articles
  FOR INSERT
  WITH CHECK (
    current_setting('app.current_user_id', true) <> ''
  );

-- 3) SELECT policy
DROP POLICY IF EXISTS articles_select_policy ON articles;
CREATE POLICY articles_select_policy
  ON articles
  FOR SELECT
  USING (
    user_id::text = current_setting('app.current_user_id', true)
  );

-- 4) UPDATE policy
DROP POLICY IF EXISTS articles_update_policy ON articles;
CREATE POLICY articles_update_policy
  ON articles
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    user_id::text = current_setting('app.current_user_id', true)
  );

-- 5) DELETE policy
DROP POLICY IF EXISTS articles_delete_policy ON articles;
CREATE POLICY articles_delete_policy
  ON articles
  FOR DELETE
  USING (
    user_id::text = current_setting('app.current_user_id', true)
  );

