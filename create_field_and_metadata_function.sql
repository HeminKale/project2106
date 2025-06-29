-- Create the missing create_field_and_metadata function
-- This function combines the functionality of both regular fields and reference fields

CREATE OR REPLACE FUNCTION public.create_field_and_metadata(
  p_api_name text,
  p_default_value text DEFAULT null,
  p_display_label text,
  p_display_order integer DEFAULT 0,
  p_field_type text,
  p_is_nullable boolean DEFAULT true,
  p_is_required boolean DEFAULT false,
  p_is_system_field boolean DEFAULT false,
  p_is_visible boolean DEFAULT true,
  p_reference_table text DEFAULT null,
  p_section text DEFAULT 'details',
  p_table_name text,
  p_validation_rules jsonb DEFAULT '[]'::jsonb,
  p_width text DEFAULT 'half'
)
RETURNS json AS $$
DECLARE
  sql_statement text;
  max_order integer;
  new_field_id uuid;
BEGIN
  -- Validate table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = p_table_name AND table_schema = 'public'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Table does not exist: ' || p_table_name);
  END IF;

  -- Validate field type
  IF p_field_type NOT IN ('text', 'varchar(255)', 'integer', 'decimal(10,2)', 'boolean', 'date', 'timestamptz', 'uuid', 'jsonb', 'reference') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid field type: ' || p_field_type);
  END IF;

  -- Build the ALTER TABLE statement
  IF p_field_type = 'reference' THEN
    -- For reference fields, create UUID column with foreign key
    sql_statement := format('ALTER TABLE %I ADD COLUMN %I uuid', 
      p_table_name, 
      p_api_name
    );
    
    -- Add NOT NULL if required
    IF p_is_required THEN
      sql_statement := sql_statement || ' NOT NULL';
    END IF;
    
    -- Add foreign key constraint if reference table is specified
    IF p_reference_table IS NOT NULL THEN
      sql_statement := sql_statement || format(' REFERENCES %I(id)', p_reference_table);
    END IF;
  ELSE
    -- For regular fields
    sql_statement := format('ALTER TABLE %I ADD COLUMN %I %s', 
      p_table_name, 
      p_api_name, 
      p_field_type
    );
    
    -- Add NOT NULL if required
    IF p_is_required THEN
      sql_statement := sql_statement || ' NOT NULL';
    END IF;
  END IF;
  
  -- Add default value if provided
  IF p_default_value IS NOT NULL THEN
    sql_statement := sql_statement || format(' DEFAULT %L', p_default_value);
  END IF;
  
  -- Execute the SQL to create the column
  EXECUTE sql_statement;
  
  -- Create index for better performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_%s ON %I(%I)', 
    p_table_name, p_api_name, p_table_name, p_api_name);
  
  -- Get the next display order if not provided
  IF p_display_order = 0 THEN
    SELECT COALESCE(MAX(display_order), 0) + 1 
    INTO max_order 
    FROM field_metadata 
    WHERE table_name = p_table_name;
  ELSE
    max_order := p_display_order;
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
    validation_rules,
    display_order,
    section,
    width,
    is_visible,
    is_system_field,
    reference_table,
    reference_display_field
  ) VALUES (
    p_table_name,
    p_api_name,
    p_display_label,
    p_field_type,
    p_is_required,
    p_is_nullable,
    p_default_value,
    p_validation_rules,
    max_order,
    p_section,
    p_width,
    p_is_visible,
    p_is_system_field,
    p_reference_table,
    CASE WHEN p_field_type = 'reference' THEN 'name' ELSE NULL END
  ) RETURNING id INTO new_field_id;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Field created successfully',
    'field_id', new_field_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_field_and_metadata(text, text, text, integer, text, boolean, boolean, boolean, boolean, text, text, text, jsonb, text) TO authenticated, anon, public; 