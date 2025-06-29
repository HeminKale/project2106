-- Comprehensive script to create all missing functions
-- Run this in your Supabase SQL Editor

-- 1. Create Field and Metadata Function
CREATE OR REPLACE FUNCTION public.create_field_and_metadata(
  p_api_name text,
  p_display_label text,
  p_field_type text,
  p_table_name text,
  p_is_required boolean DEFAULT false,
  p_is_nullable boolean DEFAULT true,
  p_is_system_field boolean DEFAULT false,
  p_is_visible boolean DEFAULT true,
  p_section text DEFAULT 'details',
  p_width text DEFAULT 'half',
  p_default_value text DEFAULT null,
  p_display_order integer DEFAULT 0,
  p_reference_table text DEFAULT null,
  p_validation_rules jsonb DEFAULT '[]'::jsonb
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

-- 2. Update Field Metadata Function
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

-- 3. Delete Field and Column Function
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

-- 4. Get Database Objects Function
CREATE OR REPLACE FUNCTION public.get_database_objects()
RETURNS TABLE(
  table_name text,
  label text,
  table_schema text,
  table_type text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::text,
    COALESCE(om.label, initcap(replace(t.table_name, '_', ' ')))::text as label,
    t.table_schema::text,
    t.table_type::text
  FROM information_schema.tables t
  LEFT JOIN object_metadata om ON t.table_name = om.api_name
  WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT IN ('schema_migrations', 'supabase_migrations')
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Get Table Columns Function
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name_param text)
RETURNS TABLE(
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text
  FROM information_schema.columns c
  WHERE c.table_name = table_name_param 
    AND c.table_schema = 'public'
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Execute SQL Function
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text)
RETURNS json AS $$
BEGIN
  EXECUTE sql_query;
  RETURN json_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Archive Object Function
CREATE OR REPLACE FUNCTION public.archive_object(table_name_param text)
RETURNS json AS $$
BEGIN
  -- Update object_metadata to mark as archived
  UPDATE object_metadata 
  SET is_archived = true, updated_at = now()
  WHERE api_name = table_name_param;
  
  RETURN json_build_object('success', true, 'message', 'Object archived successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Get Related Lists Function
CREATE OR REPLACE FUNCTION public.get_related_lists(p_parent_table text)
RETURNS TABLE(
  id uuid,
  parent_table text,
  child_table text,
  foreign_key_field text,
  label text,
  display_columns jsonb,
  section text,
  display_order integer,
  is_visible boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rlm.id,
    rlm.parent_table,
    rlm.child_table,
    rlm.foreign_key_field,
    rlm.label,
    rlm.display_columns,
    rlm.section,
    rlm.display_order,
    rlm.is_visible
  FROM related_list_metadata rlm
  WHERE rlm.parent_table = p_parent_table
  ORDER BY rlm.section, rlm.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Suggest Related Lists Function
CREATE OR REPLACE FUNCTION public.suggest_related_lists(p_parent text)
RETURNS TABLE(
  id uuid,
  parent_table text,
  child_table text,
  foreign_key_field text,
  label text,
  display_columns jsonb,
  section text,
  display_order integer,
  is_visible boolean
) AS $$
DECLARE
  child_record RECORD;
BEGIN
  -- Loop through all tables to find potential related lists
  FOR child_record IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name != p_parent
  LOOP
    -- Check if this table has a foreign key to the parent
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = child_record.table_name
        AND ccu.table_name = p_parent
    ) THEN
      -- Return a suggested related list
      RETURN QUERY
      SELECT 
        gen_random_uuid() as id,
        p_parent as parent_table,
        child_record.table_name as child_table,
        'parent_id' as foreign_key_field, -- This is a guess, would need to be refined
        'Related ' || initcap(replace(child_record.table_name, '_', ' ')) as label,
        '["id", "name"]'::jsonb as display_columns,
        'details' as section,
        0 as display_order,
        true as is_visible;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create Related List Function
CREATE OR REPLACE FUNCTION public.create_related_list(
  p_parent_table text,
  p_child_table text,
  p_foreign_key_field text,
  p_label text,
  p_display_columns jsonb DEFAULT '["id", "name"]'::jsonb,
  p_section text DEFAULT 'details',
  p_display_order int DEFAULT 0
)
RETURNS json AS $$
DECLARE
  new_related_list_id uuid;
BEGIN
  -- Insert the related list metadata
  INSERT INTO related_list_metadata (
    parent_table,
    child_table,
    foreign_key_field,
    label,
    display_columns,
    section,
    display_order
  ) VALUES (
    p_parent_table,
    p_child_table,
    p_foreign_key_field,
    p_label,
    p_display_columns,
    p_section,
    p_display_order
  ) RETURNING id INTO new_related_list_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Related list created successfully',
    'id', new_related_list_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Update Related List Function
CREATE OR REPLACE FUNCTION public.update_related_list(
  p_id uuid,
  p_label text,
  p_display_columns jsonb,
  p_section text,
  p_display_order integer,
  p_is_visible boolean
)
RETURNS json AS $$
BEGIN
  UPDATE related_list_metadata SET
    label = p_label,
    display_columns = p_display_columns,
    section = p_section,
    display_order = p_display_order,
    is_visible = p_is_visible,
    updated_at = now()
  WHERE id = p_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Related list updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Delete Related List Function
CREATE OR REPLACE FUNCTION public.delete_related_list(p_id uuid)
RETURNS json AS $$
BEGIN
  DELETE FROM related_list_metadata WHERE id = p_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Related list deleted successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for all functions
GRANT EXECUTE ON FUNCTION public.create_field_and_metadata(text, text, text, text, boolean, boolean, boolean, boolean, text, text, text, jsonb, text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.update_field_metadata(text, text, uuid, text, boolean, boolean, boolean, boolean, text, text, text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.delete_field_and_column(text, uuid, text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_database_objects() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_table_columns(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.execute_sql(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.archive_object(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_related_lists(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.suggest_related_lists(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.create_related_list(text, text, text, text, jsonb, text, integer) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.update_related_list(uuid, text, jsonb, text, integer, boolean) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.delete_related_list(uuid) TO authenticated, anon, public; 