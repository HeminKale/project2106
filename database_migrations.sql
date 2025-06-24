-- Add soft delete columns to object_metadata table
ALTER TABLE object_metadata
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID;

-- Create index for better performance on archived queries
CREATE INDEX IF NOT EXISTS idx_object_metadata_archived 
ON object_metadata(is_archived) 
WHERE is_archived = FALSE; 