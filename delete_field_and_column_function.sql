-- Create the missing delete_field_and_column function
-- This function deletes both the database column and the metadata

CREATE OR REPLACE FUNCTION public.delete_field_and_column(
  table_name_param text,
  field_id_param uuid,
  api_name_param text
)
RETURNS json AS $$
DECLARE
  current_field record;
BEGIN
  -- Get current field information
  SELECT * INTO current_field
  FROM field_metadata
  WHERE id = field_id_param AND table_name = table_name_param;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Field not found');
  END IF;

  -- Check if it's a system field
  IF current_field.is_system_field THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete system fields');
  END IF;

  -- Drop the column from the table
  EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', 
    table_name_param, 
    api_name_param
  );
  
  -- Delete the metadata record
  DELETE FROM field_metadata 
  WHERE id = field_id_param;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Field deleted successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.delete_field_and_column(text, uuid, text) TO authenticated, anon, public; 