ALTER TABLE users ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add unique constraint only if it doesn't exist
DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_token_identifier_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_token_identifier_unique UNIQUE (token_identifier);
    END IF;
END
$do$;

UPDATE users SET is_approved = TRUE WHERE created_at < NOW();

INSERT INTO users (id, email, full_name, token_identifier, is_admin, is_approved, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'nimeshpatel210@gmail.com',
  'Quiz Master Admin',
  'admin-master-account',
  TRUE,
  TRUE,
  NOW(),
  NOW()
) ON CONFLICT (token_identifier) DO NOTHING;