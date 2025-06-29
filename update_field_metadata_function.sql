-- Create the missing update_field_metadata function
-- This function updates field metadata without changing the database column

CREATE OR REPLACE FUNCTION public.update_field_metadata(
  default_value_param text DEFAULT null,
  display_label_param text,
  field_id_param uuid,
  field_type_param text,
  is_nullable_param boolean,
  is_required_param boolean,
  is_system_field_param boolean,
  is_visible_param boolean,
  reference_table_param text DEFAULT null,
  section_param text DEFAULT 'details',
  width_param text DEFAULT 'half'
)
RETURNS json AS $$
DECLARE
  current_field record;
BEGIN
  -- Get current field information
  SELECT * INTO current_field
  FROM field_metadata
  WHERE id = field_id_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Field not found');
  END IF;

  -- Update the field metadata
  UPDATE field_metadata SET
    display_label = display_label_param,
    field_type = field_type_param,
    is_required = is_required_param,
    is_nullable = is_nullable_param,
    is_system_field = is_system_field_param,
    is_visible = is_visible_param,
    reference_table = reference_table_param,
    section = section_param,
    width = width_param,
    default_value = default_value_param,
    updated_at = now()
  WHERE id = field_id_param;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Field updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_field_metadata(text, text, uuid, text, boolean, boolean, boolean, boolean, text, text, text) TO authenticated, anon, public; 