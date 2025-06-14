/*
  # Add Field Metadata System

  1. New Tables
    - `field_metadata`
      - `id` (uuid, primary key)
      - `table_name` (text, required)
      - `api_name` (text, required) - The actual column name in the database
      - `display_label` (text, required) - The label shown in the UI
      - `field_type` (text, required) - Data type (text, integer, etc.)
      - `is_required` (boolean, default false)
      - `is_nullable` (boolean, default true)
      - `default_value` (text)
      - `validation_rules` (jsonb) - Store validation rules as JSON
      - `display_order` (integer, default 0)
      - `section` (text, default 'basic') - UI section (basic, details, system)
      - `width` (text, default 'half') - UI width (half, full)
      - `is_visible` (boolean, default true)
      - `is_system_field` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on field_metadata table
    - Add policies for CRUD operations

  3. Functions
    - Function to sync existing columns to metadata table
    - Function to create field with metadata
*/

-- Create field_metadata table
CREATE TABLE IF NOT EXISTS field_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  api_name text NOT NULL,
  display_label text NOT NULL,
  field_type text NOT NULL,
  is_required boolean DEFAULT false,
  is_nullable boolean DEFAULT true,
  default_value text,
  validation_rules jsonb DEFAULT '[]'::jsonb,
  display_order integer DEFAULT 0,
  section text DEFAULT 'basic',
  width text DEFAULT 'half',
  is_visible boolean DEFAULT true,
  is_system_field boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(table_name, api_name)
);

-- Add check constraints
ALTER TABLE field_metadata ADD CONSTRAINT field_metadata_section_check 
CHECK (section IN ('basic', 'details', 'system'));

ALTER TABLE field_metadata ADD CONSTRAINT field_metadata_width_check 
CHECK (width IN ('half', 'full'));

-- Enable RLS
ALTER TABLE field_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage field metadata"
  ON field_metadata
  FOR ALL
  TO authenticated, anon, public
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE TRIGGER update_field_metadata_updated_at 
    BEFORE UPDATE ON field_metadata 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to sync existing columns to metadata table
CREATE OR REPLACE FUNCTION sync_table_metadata(table_name_param text)
RETURNS json AS $$
DECLARE
  col_record RECORD;
  display_label_text text;
  section_name text;
  is_system boolean;
  field_order integer := 0;
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
      is_system_field
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
      is_system
    );
    
    field_order := field_order + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'message', 'Metadata synced successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create field with metadata
CREATE OR REPLACE FUNCTION create_field_with_metadata(
  table_name_param text,
  api_name_param text,
  display_label_param text,
  field_type_param text,
  is_required_param boolean DEFAULT false,
  default_value_param text DEFAULT null,
  section_param text DEFAULT 'details',
  width_param text DEFAULT 'half'
)
RETURNS json AS $$
DECLARE
  sql_statement text;
  max_order integer;
BEGIN
  -- Build the ALTER TABLE statement
  sql_statement := format('ALTER TABLE %I ADD COLUMN %I %s', 
    table_name_param, 
    api_name_param, 
    field_type_param
  );
  
  -- Add NOT NULL if required
  IF is_required_param THEN
    sql_statement := sql_statement || ' NOT NULL';
  END IF;
  
  -- Add default value if provided
  IF default_value_param IS NOT NULL THEN
    sql_statement := sql_statement || format(' DEFAULT %L', default_value_param);
  END IF;
  
  -- Execute the SQL to create the column
  EXECUTE sql_statement;
  
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
    is_system_field
  ) VALUES (
    table_name_param,
    api_name_param,
    display_label_param,
    field_type_param,
    is_required_param,
    NOT is_required_param,
    default_value_param,
    max_order,
    section_param,
    width_param,
    false
  );
  
  RETURN json_build_object('success', true, 'message', 'Field created successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get field metadata for a table
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
  is_system_field boolean
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
    fm.is_system_field
  FROM field_metadata fm
  WHERE fm.table_name = table_name_param
  ORDER BY fm.display_order, fm.api_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sync_table_metadata(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION create_field_with_metadata(text, text, text, text, boolean, text, text, text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_field_metadata(text) TO authenticated, anon, public;

-- Sync metadata for existing tables
SELECT sync_table_metadata('clients');
SELECT sync_table_metadata('channel_partners');
SELECT sync_table_metadata('billing');
SELECT sync_table_metadata('users');