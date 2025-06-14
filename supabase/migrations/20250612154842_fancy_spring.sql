-- Drop existing functions and recreate without auth.uid() checks
DROP FUNCTION IF EXISTS execute_sql(text);
DROP FUNCTION IF EXISTS get_database_objects();
DROP FUNCTION IF EXISTS get_table_columns(text);
DROP FUNCTION IF EXISTS test_admin_functions();

-- Function to execute SQL statements (for creating objects and fields)
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Log the SQL being executed for debugging
  RAISE NOTICE 'Executing SQL: %', sql;
  
  -- Execute the SQL
  EXECUTE sql;
  
  -- Return success
  RETURN json_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error for debugging
    RAISE NOTICE 'SQL execution error: %', SQLERRM;
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get database objects
CREATE OR REPLACE FUNCTION get_database_objects()
RETURNS TABLE(table_name text, table_schema text, table_type text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text, t.table_schema::text, t.table_type::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    AND t.table_name NOT LIKE 'sql_%'
  ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(table_name_param text)
RETURNS TABLE(
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  character_maximum_length integer,
  table_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.character_maximum_length::integer,
    c.table_name::text
  FROM information_schema.columns c
  WHERE c.table_name = table_name_param
    AND c.table_schema = 'public'
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a test function to verify the functions work
CREATE OR REPLACE FUNCTION test_admin_functions()
RETURNS json AS $$
DECLARE
  test_result json;
BEGIN
  -- Test that we can call the functions
  PERFORM get_database_objects();
  PERFORM get_table_columns('clients');
  
  RETURN json_build_object('success', true, 'message', 'All admin functions are working correctly');
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to all roles (since we're using custom auth)
GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_database_objects() TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION test_admin_functions() TO authenticated, anon, public;

-- Also ensure the functions are accessible via RPC
COMMENT ON FUNCTION execute_sql(text) IS 'Execute SQL statements for admin operations';
COMMENT ON FUNCTION get_database_objects() IS 'Get list of database tables';
COMMENT ON FUNCTION get_table_columns(text) IS 'Get columns for a specific table';
COMMENT ON FUNCTION test_admin_functions() IS 'Test that admin functions are working';