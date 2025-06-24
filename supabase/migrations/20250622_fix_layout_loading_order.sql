-- This migration updates the get_field_metadata function
-- to ensure that fields are returned in the exact order specified by 'display_order'.
-- This fixes a bug where the UI layout would not persist after a refresh.

-- First, we drop the existing function because its return signature might have changed,
-- which prevents a simple 'CREATE OR REPLACE' from working.
DROP FUNCTION IF EXISTS public.get_field_metadata(text);

-- Now, we create the function with the corrected 'ORDER BY' clause.
CREATE OR REPLACE FUNCTION public.get_field_metadata(table_name_param text)
RETURNS TABLE(
  id uuid,
  table_name text,
  api_name text,
  display_label text,
  field_type text,
  is_required boolean,
  is_nullable boolean,
  default_value text,
  validation_rules jsonb,
  display_order integer,
  section text,
  width text,
  is_visible boolean,
  is_system_field boolean,
  reference_table text,
  reference_display_field text
)
LANGUAGE plpgsql
SECURITY DEFINER AS
$$
BEGIN
  RETURN QUERY
  SELECT
    fm.id,
    fm.table_name,
    fm.api_name,
    fm.display_label,
    fm.field_type,
    fm.is_required,
    fm.is_nullable,
    fm.default_value,
    fm.validation_rules,
    fm.display_order,
    fm.section,
    fm.width,
    fm.is_visible,
    fm.is_system_field,
    fm.reference_table,
    fm.reference_display_field
  FROM public.field_metadata fm
  WHERE fm.table_name = table_name_param
  ORDER BY fm.display_order; -- Sort ONLY by the specified display order
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_field_metadata(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_field_metadata(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_field_metadata(text) TO public; 