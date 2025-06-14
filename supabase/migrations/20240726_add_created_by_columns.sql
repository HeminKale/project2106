-- Add created_by column to clients table
ALTER TABLE clients
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Add created_by column to channel_partners table
ALTER TABLE channel_partners
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Add created_by column to billing table
ALTER TABLE billing
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- IMPORTANT: For existing rows, the new 'created_by' column will be NULL.
-- You will need to manually backfill this data for existing records if you want RLS
-- to apply to them or if you plan to make the column NOT NULL later.
-- Example to backfill with the ID of the current authenticated user (run this in Supabase SQL editor or a separate migration):
-- UPDATE clients SET created_by = auth.uid() WHERE created_by IS NULL;
-- UPDATE channel_partners SET created_by = auth.uid() WHERE created_by IS NULL;
-- UPDATE billing SET created_by = auth.uid() WHERE created_by IS NULL;

-- If you want to enforce NOT NULL for future inserts, after backfilling:
-- ALTER TABLE clients ALTER COLUMN created_by SET NOT NULL;
-- ALTER TABLE channel_partners ALTER COLUMN created_by SET NOT NULL;
-- ALTER TABLE billing ALTER COLUMN created_by SET NOT NULL; 