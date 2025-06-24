-- Migration: Add Section Types Support
-- This adds support for different section types (field vs related list)

-- Add section_type column to layout_blocks table
ALTER TABLE public.layout_blocks 
ADD COLUMN IF NOT EXISTS section_type text DEFAULT 'field' CHECK (section_type IN ('field', 'related'));

-- Add display_columns column for related list sections
ALTER TABLE public.layout_blocks 
ADD COLUMN IF NOT EXISTS display_columns jsonb DEFAULT '["id", "name"]'::jsonb;

-- Update existing layout blocks to have proper section_type
UPDATE public.layout_blocks 
SET section_type = CASE 
  WHEN block_type = 'field' THEN 'field'
  WHEN block_type = 'related_list' THEN 'related'
  ELSE 'field'
END;

-- Create a new table for section metadata
CREATE TABLE IF NOT EXISTS public.section_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  section_name text NOT NULL,
  section_type text NOT NULL CHECK (section_type IN ('field', 'related')),
  display_columns jsonb DEFAULT '["id", "name"]'::jsonb,
  display_order integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(table_name, section_name)
);

-- Enable RLS on section_metadata
ALTER TABLE public.section_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for section_metadata
CREATE POLICY "Users can manage section_metadata"
  ON public.section_metadata
  FOR ALL
  TO authenticated, anon, public
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_section_metadata_updated_at 
  BEFORE UPDATE ON public.section_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create a section
CREATE OR REPLACE FUNCTION public.create_section(
  p_table_name text,
  p_section_name text,
  p_section_type text DEFAULT 'field',
  p_display_columns jsonb DEFAULT '["id", "name"]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  new_section_id uuid;
  result json;
BEGIN
  -- Validate section type
  IF p_section_type NOT IN ('field', 'related') THEN
    RAISE EXCEPTION 'Invalid section type: %. Must be "field" or "related"', p_section_type;
  END IF;

  -- Insert the section metadata
  INSERT INTO public.section_metadata (
    table_name,
    section_name,
    section_type,
    display_columns,
    display_order
  ) VALUES (
    p_table_name,
    p_section_name,
    p_section_type,
    p_display_columns,
    COALESCE((SELECT MAX(display_order) + 1 FROM public.section_metadata WHERE table_name = p_table_name), 0)
  ) RETURNING id INTO new_section_id;

  -- Return the created section
  SELECT json_build_object(
    'id', id,
    'table_name', table_name,
    'section_name', section_name,
    'section_type', section_type,
    'display_columns', display_columns,
    'display_order', display_order,
    'is_visible', is_visible
  ) INTO result
  FROM public.section_metadata
  WHERE id = new_section_id;

  RETURN result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Section already exists');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to get sections for a table
CREATE OR REPLACE FUNCTION public.get_sections(
  p_table_name text
)
RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', id,
        'table_name', table_name,
        'section_name', section_name,
        'section_type', section_type,
        'display_columns', display_columns,
        'display_order', display_order,
        'is_visible', is_visible
      )
    )
    FROM public.section_metadata
    WHERE table_name = p_table_name AND is_visible = true
    ORDER BY display_order
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_section(text, text, text, jsonb) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_sections(text) TO authenticated, anon, public; 