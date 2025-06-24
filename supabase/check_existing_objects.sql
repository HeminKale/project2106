-- Diagnostic Script: Check Existing Objects
-- Run this before any migration to see what already exists

-- Check if layout_blocks table exists
SELECT 
  'layout_blocks table' as object_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'layout_blocks') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

-- Check if related_list_metadata table exists
SELECT 
  'related_list_metadata table' as object_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'related_list_metadata') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

-- Check if field_metadata table exists
SELECT 
  'field_metadata table' as object_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_metadata') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

-- Check existing functions
SELECT 
  'get_layout_blocks function' as object_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_layout_blocks') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

SELECT 
  'update_layout_blocks function' as object_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_layout_blocks') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

SELECT 
  'add_field_to_layout function' as object_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'add_field_to_layout') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

SELECT 
  'add_related_list_to_layout function' as object_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'add_related_list_to_layout') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

-- Check existing triggers
SELECT 
  'update_layout_blocks_updated_at trigger' as object_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_layout_blocks_updated_at' 
      AND event_object_table = 'layout_blocks'
    ) 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

-- Check existing policies
SELECT 
  'Users can manage layout_blocks policy' as object_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'layout_blocks' 
      AND policyname = 'Users can manage layout_blocks'
    ) 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

-- Check existing indexes
SELECT 
  'idx_layout_blocks_table_name index' as object_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_layout_blocks_table_name'
    ) 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

SELECT 
  'idx_layout_blocks_section_order index' as object_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_layout_blocks_section_order'
    ) 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status;

-- Check table structure if layout_blocks exists
DO $$
DECLARE
  col_record RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'layout_blocks') THEN
    RAISE NOTICE 'layout_blocks table columns:';
    FOR col_record IN 
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'layout_blocks' 
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '  %: % (nullable: %, default: %)', 
        col_record.column_name, col_record.data_type, col_record.is_nullable, col_record.column_default;
    END LOOP;
  ELSE
    RAISE NOTICE 'layout_blocks table does not exist';
  END IF;
END $$; 