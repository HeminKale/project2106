-- RPC Functions for Related Lists Management

-- Function to create a related list
CREATE OR REPLACE FUNCTION public.create_related_list(
  p_parent_table text,
  p_child_table text,
  p_foreign_key_field text,
  p_label text,
  p_display_columns jsonb DEFAULT '["id", "name"]',
  p_section text DEFAULT 'details',
  p_display_order int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  new_related_list_id uuid;
  result json;
BEGIN
  -- Validate that parent table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_parent_table) THEN
    RAISE EXCEPTION 'Parent table % does not exist', p_parent_table;
  END IF;

  -- Validate that child table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_child_table) THEN
    RAISE EXCEPTION 'Child table % does not exist', p_child_table;
  END IF;

  -- Validate that foreign key field exists in child table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = p_child_table AND column_name = p_foreign_key_field
  ) THEN
    RAISE EXCEPTION 'Foreign key field % does not exist in table %', p_foreign_key_field, p_child_table;
  END IF;

  -- Insert the related list metadata
  INSERT INTO public.related_list_metadata (
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

  -- Return the created related list
  SELECT json_build_object(
    'id', id,
    'parent_table', parent_table,
    'child_table', child_table,
    'foreign_key_field', foreign_key_field,
    'label', label,
    'display_columns', display_columns,
    'section', section,
    'display_order', display_order
  ) INTO result
  FROM public.related_list_metadata
  WHERE id = new_related_list_id;

  RETURN result;
END;
$$;

-- Function to update a related list
CREATE OR REPLACE FUNCTION public.update_related_list(
  p_id uuid,
  p_label text DEFAULT NULL,
  p_display_columns jsonb DEFAULT NULL,
  p_section text DEFAULT NULL,
  p_display_order int DEFAULT NULL,
  p_is_visible boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  result json;
BEGIN
  -- Update the related list
  UPDATE public.related_list_metadata
  SET 
    label = COALESCE(p_label, label),
    display_columns = COALESCE(p_display_columns, display_columns),
    section = COALESCE(p_section, section),
    display_order = COALESCE(p_display_order, display_order),
    is_visible = COALESCE(p_is_visible, is_visible),
    updated_at = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Related list with id % not found', p_id;
  END IF;

  -- Return the updated related list
  SELECT json_build_object(
    'id', id,
    'parent_table', parent_table,
    'child_table', child_table,
    'foreign_key_field', foreign_key_field,
    'label', label,
    'display_columns', display_columns,
    'section', section,
    'display_order', display_order,
    'is_visible', is_visible
  ) INTO result
  FROM public.related_list_metadata
  WHERE id = p_id;

  RETURN result;
END;
$$;

-- Function to delete a related list
CREATE OR REPLACE FUNCTION public.delete_related_list(
  p_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.related_list_metadata
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Related list with id % not found', p_id;
  END IF;

  RETURN true;
END;
$$;

-- Function to get related lists for a table
CREATE OR REPLACE FUNCTION public.get_related_lists(
  p_parent_table text
)
RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', id,
        'parent_table', parent_table,
        'child_table', child_table,
        'foreign_key_field', foreign_key_field,
        'label', label,
        'display_columns', display_columns,
        'section', section,
        'display_order', display_order,
        'is_visible', is_visible
      )
    )
    FROM public.related_list_metadata
    WHERE parent_table = p_parent_table AND is_visible = true
    ORDER BY section, display_order
  );
END;
$$;

-- Extended function to get both fields and related lists for page layout
CREATE OR REPLACE FUNCTION public.get_page_layout(
  p_table text
)
RETURNS json
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN json_build_object(
    'fields', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'table_name', table_name,
          'api_name', api_name,
          'display_label', display_label,
          'field_type', field_type,
          'is_required', is_required,
          'is_nullable', is_nullable,
          'default_value', default_value,
          'validation_rules', validation_rules,
          'display_order', display_order,
          'section', section,
          'width', width,
          'is_visible', is_visible,
          'is_system_field', is_system_field,
          'reference_table', reference_table,
          'reference_display_field', reference_display_field
        )
      )
      FROM field_metadata 
      WHERE table_name = p_table AND is_visible = true
      ORDER BY section, display_order
    ),
    'relatedLists', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'parent_table', parent_table,
          'child_table', child_table,
          'foreign_key_field', foreign_key_field,
          'label', label,
          'display_columns', display_columns,
          'section', section,
          'display_order', display_order,
          'is_visible', is_visible
        )
      )
      FROM related_list_metadata
      WHERE parent_table = p_table AND is_visible = true
      ORDER BY section, display_order
    )
  );
END;
$$; 