-- Update the RPC function to correctly handle new layout blocks with temporary IDs.
CREATE OR REPLACE FUNCTION public.update_layout_blocks(p_table_name text, p_layout_blocks jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    block jsonb;
BEGIN
    -- First, delete all existing blocks for the given table
    -- This is a simple approach; a more sophisticated one might be to diff changes.
    DELETE FROM public.layout_blocks WHERE table_name = p_table_name;

    -- Then, insert all the blocks from the payload
    FOR block IN SELECT * FROM jsonb_array_elements(p_layout_blocks)
    LOOP
        INSERT INTO public.layout_blocks (
            id,
            table_name,
            block_type,
            field_id,
            related_list_id,
            label,
            section,
            display_order,
            width
        )
        VALUES (
            -- If the ID starts with 'temp-', generate a new UUID. Otherwise, use the provided ID.
            CASE 
                WHEN (block->>'id') LIKE 'temp-%' THEN gen_random_uuid()
                ELSE (block->>'id')::uuid
            END,
            p_table_name,
            (block->>'block_type')::public.layout_block_type,
            (block->>'field_id')::uuid,
            (block->>'related_list_id')::uuid,
            block->>'label',
            block->>'section',
            (block->>'display_order')::integer,
            block->>'width'
        );
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_layout_blocks(text, jsonb) TO authenticated, anon, public; 