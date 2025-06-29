-- Migration to add a function that suggests potential related lists
-- based on foreign key relationships.

-- First, create a view to simplify finding foreign key constraints
CREATE OR REPLACE VIEW public.v_foreign_key_relationships AS
SELECT
    kcu.table_schema AS child_schema,
    kcu.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_schema AS parent_schema,
    ccu.table_name AS parent_table,
    ccu.column_name AS parent_column
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY';

-- Function to suggest related lists for a given parent table
CREATE OR REPLACE FUNCTION public.suggest_related_lists(p_parent text)
RETURNS TABLE(id uuid, parent_table text, child_table text, foreign_key_field text, label text, display_columns jsonb, section text, display_order integer, is_visible boolean)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        gen_random_uuid() as id,
        fk.parent_table::text,
        fk.child_table::text,
        fk.child_column::text as foreign_key_field,
        -- Generate a human-friendly label, e.g., 'Child Table Name (s)'
        initcap(replace(fk.child_table, '_', ' ')) || 's' as label,
        '["id", "name"]'::jsonb as display_columns,
        'details'::text as section,
        0 as display_order,
        true as is_visible
    FROM 
        public.v_foreign_key_relationships fk
    WHERE 
        fk.parent_table = p_parent
    AND NOT EXISTS (
        -- Exclude any relationships that are already configured in related_list_metadata
        SELECT 1
        FROM public.related_list_metadata rl
        WHERE rl.parent_table = fk.parent_table
          AND rl.child_table = fk.child_table
          AND rl.foreign_key_field = fk.child_column
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_related_lists(text) TO authenticated, anon, public; 