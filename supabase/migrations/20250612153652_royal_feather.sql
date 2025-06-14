/*
  # Settings Management Functions

  1. New Functions
    - `execute_sql` - Execute dynamic SQL statements
    - `get_database_objects` - Get all database tables
    - `get_table_columns` - Get columns for a specific table

  2. Security
    - Functions are security definer and restricted to authenticated users
    - Proper error handling and validation
*/

-- Function to execute SQL statements (for creating objects and fields)
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- Only allow authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Execute the SQL
  EXECUTE sql;
  
  -- Return success
  RETURN json_build_object('success', true, 'message', 'SQL executed successfully');
EXCEPTION
  WHEN OTHERS THEN
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_objects() TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;