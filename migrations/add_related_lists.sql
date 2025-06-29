-- Migration: Add Related Lists functionality
-- This adds the ability to create related lists between objects

-- Create the related_list_metadata table
CREATE TABLE IF NOT EXISTS public.related_list_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_table text NOT NULL,
  child_table text NOT NULL,
  foreign_key_field text NOT NULL,
  label text NOT NULL,
  display_columns jsonb DEFAULT '["id", "name"]',
  section text DEFAULT 'details',
  display_order int DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.related_list_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage related_list_metadata"
  ON public.related_list_metadata
  FOR ALL
  TO authenticated, anon, public
  USING (true)
  WITH CHECK (true);

-- Create convenience view for page layout
CREATE OR REPLACE VIEW public.v_related_lists AS
SELECT *
FROM related_list_metadata
WHERE is_visible = true
ORDER BY parent_table, section, display_order;

-- Add trigger for updated_at
CREATE TRIGGER update_related_list_metadata_updated_at 
  BEFORE UPDATE ON public.related_list_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for user tracking
CREATE TRIGGER update_related_list_metadata_user_tracking
  BEFORE INSERT OR UPDATE ON public.related_list_metadata
  FOR EACH ROW EXECUTE FUNCTION update_user_tracking_columns(); 