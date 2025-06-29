-- This script updates the function to be a more efficient, set-based operation
-- that only performs updates, avoiding check constraint violations on insert.
CREATE OR REPLACE FUNCTION public.update_field_layout(
  table_name_param text,
  field_layouts jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS
$$
BEGIN
  -- This set-based update is more efficient than a loop.
  -- It updates rows in field_metadata based on the matching id and table_name
  -- from the provided JSONB array of layouts.
  UPDATE public.field_metadata fm
  SET
    section       = l->>'section',
    width         = l->>'width',
    display_order = (l->>'display_order')::integer
  FROM jsonb_array_elements(field_layouts) AS l
  WHERE
    fm.id = (l->>'id')::uuid AND
    fm.table_name = table_name_param;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_field_layout(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_field_layout(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.update_field_layout(text, jsonb) TO public; 