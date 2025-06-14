/*
  # Add Reference Field Support to Settings System

  1. Updates to field_metadata table
    - Add reference_table column to store which table this field references
    - Add reference_display_field column to store which field to display in dropdowns

  2. New Functions
    - create_reference_field_with_metadata() - Create reference fields with foreign keys
    - get_reference_options() - Get options for reference field dropdowns

  3. Security
    - Update existing policies to handle reference fields
    - Add proper validation for reference field creation
*/

-- Add reference columns to field_metadata table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'field_metadata' AND column_name = 'reference_table'
  ) THEN
    ALTER TABLE field_metadata ADD COLUMN reference_table text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'field_metadata' AND column_name = 'reference_display_field'
  ) THEN
    ALTER TABLE field_metadata ADD COLUMN reference_display_field text;
  END IF;
END $$;

-- Function to create reference field with metadata
CREATE OR REPLACE FUNCTION create_reference_field_with_metadata(
  table_name_param text,
  api_name_param text,
  display_label_param text,
  is_required_param boolean DEFAULT false,
  default_value_param text DEFAULT null,
  section_param text DEFAULT 'details',
  width_param text DEFAULT 'half',
  reference_table_param text DEFAULT null,
  reference_display_field_param text DEFAULT 'name'
)
RETURNS json AS $$
DECLARE
  sql_statement text;
  max_order integer;
BEGIN
  -- Validate reference table exists
  IF reference_table_param IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = reference_table_param AND table_schema = 'public'
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Reference table does not exist: ' || reference_table_param);
    END IF;
  END IF;

  -- Build the ALTER TABLE statement for reference field
  sql_statement := format('ALTER TABLE %I ADD COLUMN %I uuid', 
    table_name_param, 
    api_name_param
  );
  
  -- Add NOT NULL if required
  IF is_required_param THEN
    sql_statement := sql_statement || ' NOT NULL';
  END IF;
  
  -- Add foreign key constraint
  IF reference_table_param IS NOT NULL THEN
    sql_statement := sql_statement || format(' REFERENCES %I(id)', reference_table_param);
  END IF;
  
  -- Add default value if provided
  IF default_value_param IS NOT NULL THEN
    sql_statement := sql_statement || format(' DEFAULT %L', default_value_param);
  END IF;
  
  -- Execute the SQL to create the column
  EXECUTE sql_statement;
  
  -- Create index for better performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_%s ON %I(%I)', 
    table_name_param, api_name_param, table_name_param, api_name_param);
  
  -- Get the next display order
  SELECT COALESCE(MAX(display_order), 0) + 1 
  INTO max_order 
  FROM field_metadata 
  WHERE table_name = table_name_param;
  
  -- Insert metadata record
  INSERT INTO field_metadata (
    table_name,
    api_name,
    display_label,
    field_type,
    is_required,
    is_nullable,
    default_value,
    display_order,
    section,
    width,
    is_system_field,
    reference_table,
    reference_display_field
  ) VALUES (
    table_name_param,
    api_name_param,
    display_label_param,
    'uuid',
    is_required_param,
    NOT is_required_param,
    default_value_param,
    max_order,
    section_param,
    width_param,
    false,
    reference_table_param,
    reference_display_field_param
  );
  
  RETURN json_build_object('success', true, 'message', 'Reference field created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get reference options for dropdowns
CREATE OR REPLACE FUNCTION get_reference_options(
  table_name_param text,
  display_field_param text DEFAULT 'name'
)
RETURNS TABLE(
  id uuid,
  display_value text
) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT id, COALESCE(%I::text, id::text) as display_value FROM %I ORDER BY %I',
    display_field_param,
    table_name_param,
    display_field_param
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return empty result if there's an error
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_field_metadata function to include reference fields
CREATE OR REPLACE FUNCTION get_field_metadata(table_name_param text)
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
) AS $$
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
  FROM field_metadata fm
  WHERE fm.table_name = table_name_param
  ORDER BY fm.display_order, fm.api_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_reference_field_with_metadata(text, text, text, boolean, text, text, text, text, text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_reference_options(text, text) TO authenticated, anon, public;

-- Update sync_table_metadata to handle existing reference fields
CREATE OR REPLACE FUNCTION sync_table_metadata(table_name_param text)
RETURNS json AS $$
DECLARE
  col_record RECORD;
  constraint_record RECORD;
  display_label_text text;
  section_name text;
  is_system boolean;
  field_order integer := 0;
  ref_table text;
  ref_field text := 'name';
BEGIN
  -- Clear existing metadata for this table
  DELETE FROM field_metadata WHERE table_name = table_name_param;
  
  -- Loop through all columns in the table
  FOR col_record IN 
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns 
    WHERE table_name = table_name_param 
      AND table_schema = 'public'
    ORDER BY ordinal_position
  LOOP
    -- Generate display label (convert snake_case to Title Case)
    display_label_text := initcap(replace(col_record.column_name, '_', ' '));
    
    -- Determine section and system field status
    IF col_record.column_name IN ('id', 'created_at', 'updated_at', 'created_by', 'updated_by') THEN
      section_name := 'system';
      is_system := true;
    ELSIF col_record.column_name IN ('name', 'email', 'status') THEN
      section_name := 'basic';
      is_system := false;
    ELSE
      section_name := 'details';
      is_system := false;
    END IF;
    
    -- Check if this column is a foreign key
    ref_table := NULL;
    SELECT tc.table_name INTO ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = table_name_param
      AND kcu.column_name = col_record.column_name
      AND tc.table_schema = 'public';
    
    -- Insert metadata record
    INSERT INTO field_metadata (
      table_name,
      api_name,
      display_label,
      field_type,
      is_required,
      is_nullable,
      default_value,
      display_order,
      section,
      is_system_field,
      reference_table,
      reference_display_field
    ) VALUES (
      table_name_param,
      col_record.column_name,
      display_label_text,
      col_record.data_type,
      col_record.is_nullable = 'NO',
      col_record.is_nullable = 'YES',
      col_record.column_default,
      field_order,
      section_name,
      is_system,
      ref_table,
      CASE WHEN ref_table IS NOT NULL THEN ref_field ELSE NULL END
    );
    
    field_order := field_order + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Metadata synced successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-sync metadata for existing tables to pick up reference fields
SELECT sync_table_metadata('clients');
SELECT sync_table_metadata('channel_partners');
SELECT sync_table_metadata('billing');
SELECT sync_table_metadata('users');