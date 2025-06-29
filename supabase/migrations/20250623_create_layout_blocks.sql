-- Migration: Create Layout Blocks System
-- This creates a unified layout system for storing both fields and related lists together

-- Drop existing functions if they exist (to avoid conflicts)
DROP FUNCTION IF EXISTS public.get_layout_blocks(text);
DROP FUNCTION IF EXISTS public.update_layout_blocks(text, json);
DROP FUNCTION IF EXISTS public.add_field_to_layout(text, uuid, text, integer);
DROP FUNCTION IF EXISTS public.add_related_list_to_layout(text, uuid, text, integer);

-- Create the layout_blocks table
CREATE TABLE IF NOT EXISTS public.layout_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  block_type text NOT NULL CHECK (block_type IN ('field', 'related_list')),
  field_id uuid REFERENCES field_metadata(id) ON DELETE CASCADE,
  related_list_id uuid REFERENCES related_list_metadata(id) ON DELETE CASCADE,
  label text NOT NULL,
  section text DEFAULT 'details',
  display_order integer DEFAULT 0,
  width text DEFAULT 'half' CHECK (width IN ('half', 'full')),
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure either field_id or related_list_id is set, but not both
  CONSTRAINT layout_blocks_content_check CHECK (
    (block_type = 'field' AND field_id IS NOT NULL AND related_list_id IS NULL) OR
    (block_type = 'related_list' AND related_list_id IS NOT NULL AND field_id IS NULL)
  )
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_layout_blocks_table_name ON layout_blocks(table_name);
CREATE INDEX IF NOT EXISTS idx_layout_blocks_section_order ON layout_blocks(table_name, section, display_order);

-- Enable RLS
ALTER TABLE public.layout_blocks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage layout_blocks" ON public.layout_blocks;

-- Create policies
CREATE POLICY "Users can manage layout_blocks"
  ON public.layout_blocks
  FOR ALL
  TO authenticated, anon, public
  USING (true)
  WITH CHECK (true);

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_layout_blocks_updated_at ON public.layout_blocks;

-- Add triggers
CREATE TRIGGER update_layout_blocks_updated_at 
  BEFORE UPDATE ON public.layout_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC Functions for Layout Blocks Management

-- Function to get layout blocks for a table
CREATE OR REPLACE FUNCTION public.get_layout_blocks(
  p_table_name text
)
RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', lb.id,
        'table_name', lb.table_name,
        'block_type', lb.block_type,
        'field_id', lb.field_id,
        'related_list_id', lb.related_list_id,
        'label', lb.label,
        'section', lb.section,
        'display_order', lb.display_order,
        'width', lb.width,
        'is_visible', lb.is_visible,
        'field_data', CASE 
          WHEN lb.block_type = 'field' THEN (
            SELECT json_build_object(
              'id', fm.id,
              'api_name', fm.api_name,
              'display_label', fm.display_label,
              'field_type', fm.field_type,
              'is_required', fm.is_required,
              'is_nullable', fm.is_nullable,
              'default_value', fm.default_value,
              'validation_rules', fm.validation_rules,
              'reference_table', fm.reference_table,
              'reference_display_field', fm.reference_display_field
            )
            FROM field_metadata fm
            WHERE fm.id = lb.field_id
          )
          ELSE NULL
        END,
        'related_list_data', CASE 
          WHEN lb.block_type = 'related_list' THEN (
            SELECT json_build_object(
              'id', rlm.id,
              'parent_table', rlm.parent_table,
              'child_table', rlm.child_table,
              'foreign_key_field', rlm.foreign_key_field,
              'label', rlm.label,
              'display_columns', rlm.display_columns
            )
            FROM related_list_metadata rlm
            WHERE rlm.id = lb.related_list_id
          )
          ELSE NULL
        END
      )
    )
    FROM layout_blocks lb
    WHERE lb.table_name = p_table_name AND lb.is_visible = true
    ORDER BY lb.section, lb.display_order
  );
END;
$$;

-- Function to update layout blocks (replace entire layout for a table)
CREATE OR REPLACE FUNCTION public.update_layout_blocks(
  p_table_name text,
  p_layout_blocks json
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  block_record json;
  block_id uuid;
  block_type text;
  field_id uuid;
  related_list_id uuid;
  label text;
  section text;
  display_order integer;
  width text;
BEGIN
  -- Delete existing layout blocks for this table
  DELETE FROM layout_blocks WHERE table_name = p_table_name;
  
  -- Insert new layout blocks
  FOR block_record IN SELECT * FROM json_array_elements(p_layout_blocks)
  LOOP
    block_type := (block_record->>'block_type')::text;
    field_id := CASE WHEN block_record->>'field_id' IS NOT NULL 
                     THEN (block_record->>'field_id')::uuid 
                     ELSE NULL END;
    related_list_id := CASE WHEN block_record->>'related_list_id' IS NOT NULL 
                            THEN (block_record->>'related_list_id')::uuid 
                            ELSE NULL END;
    label := block_record->>'label';
    section := COALESCE(block_record->>'section', 'details');
    display_order := (block_record->>'display_order')::integer;
    width := COALESCE(block_record->>'width', 'half');
    
    INSERT INTO layout_blocks (
      table_name,
      block_type,
      field_id,
      related_list_id,
      label,
      section,
      display_order,
      width,
      is_visible
    ) VALUES (
      p_table_name,
      block_type,
      field_id,
      related_list_id,
      label,
      section,
      display_order,
      width,
      true
    ) RETURNING id INTO block_id;
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Layout updated successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to add a field to layout
CREATE OR REPLACE FUNCTION public.add_field_to_layout(
  p_table_name text,
  p_field_id uuid,
  p_section text DEFAULT 'details',
  p_display_order integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  next_order integer;
  field_label text;
BEGIN
  -- Get field label
  SELECT display_label INTO field_label
  FROM field_metadata
  WHERE id = p_field_id;
  
  -- Get next display order if not provided
  IF p_display_order IS NULL THEN
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
    FROM layout_blocks
    WHERE table_name = p_table_name AND section = p_section;
  ELSE
    next_order := p_display_order;
  END IF;
  
  -- Insert the layout block
  INSERT INTO layout_blocks (
    table_name,
    block_type,
    field_id,
    label,
    section,
    display_order,
    width,
    is_visible
  ) VALUES (
    p_table_name,
    'field',
    p_field_id,
    field_label,
    p_section,
    next_order,
    'half',
    true
  );
  
  RETURN json_build_object('success', true, 'message', 'Field added to layout');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to add a related list to layout
CREATE OR REPLACE FUNCTION public.add_related_list_to_layout(
  p_table_name text,
  p_related_list_id uuid,
  p_section text DEFAULT 'details',
  p_display_order integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  next_order integer;
  list_label text;
BEGIN
  -- Get related list label
  SELECT label INTO list_label
  FROM related_list_metadata
  WHERE id = p_related_list_id;
  
  -- Get next display order if not provided
  IF p_display_order IS NULL THEN
    SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
    FROM layout_blocks
    WHERE table_name = p_table_name AND section = p_section;
  ELSE
    next_order := p_display_order;
  END IF;
  
  -- Insert the layout block
  INSERT INTO layout_blocks (
    table_name,
    block_type,
    related_list_id,
    label,
    section,
    display_order,
    width,
    is_visible
  ) VALUES (
    p_table_name,
    'related_list',
    p_related_list_id,
    list_label,
    p_section,
    next_order,
    'full',
    true
  );
  
  RETURN json_build_object('success', true, 'message', 'Related list added to layout');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_layout_blocks(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.update_layout_blocks(text, json) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.add_field_to_layout(text, uuid, text, integer) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.add_related_list_to_layout(text, uuid, text, integer) TO authenticated, anon, public; 