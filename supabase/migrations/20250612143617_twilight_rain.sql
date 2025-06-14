/*
  # User Management System

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique, required)
      - `full_name` (text, required)
      - `role` (text, default 'employee')
      - `department` (text)
      - `is_active` (boolean, default true)
      - `last_login` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Updates to Existing Tables
    - Add `created_by` (uuid, foreign key to users) to:
      - clients
      - channel_partners
      - billing
    - Add `updated_by` (uuid, foreign key to users) to:
      - clients
      - channel_partners
      - billing

  3. Security
    - Enable RLS on users table
    - Add policies for user management
    - Update existing policies to include user context

  4. Functions
    - Function to get current user from auth.users
    - Triggers to automatically set created_by and updated_by
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text DEFAULT 'employee',
  department text,
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for user roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'manager', 'employee', 'viewer'));
  END IF;
END $$;

-- Add created_by and updated_by columns to existing tables
DO $$
BEGIN
  -- Add to clients table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE clients ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE clients ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;

  -- Add to channel_partners table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_partners' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE channel_partners ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'channel_partners' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE channel_partners ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;

  -- Add to billing table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE billing ADD COLUMN created_by uuid REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE billing ADD COLUMN updated_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id::text = auth.uid()::text 
      AND role = 'admin'
    )
  );

-- Function to get current user ID from auth
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT id FROM users 
    WHERE id::text = auth.uid()::text
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set created_by and updated_by automatically
CREATE OR REPLACE FUNCTION set_user_tracking()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := get_current_user_id();
  
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := current_user_id;
    NEW.updated_by := current_user_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := current_user_id;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for user tracking
CREATE TRIGGER clients_user_tracking
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION set_user_tracking();

CREATE TRIGGER channel_partners_user_tracking
  BEFORE INSERT OR UPDATE ON channel_partners
  FOR EACH ROW
  EXECUTE FUNCTION set_user_tracking();

CREATE TRIGGER billing_user_tracking
  BEFORE INSERT OR UPDATE ON billing
  FOR EACH ROW
  EXECUTE FUNCTION set_user_tracking();

-- Create updated_at trigger for users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample users (these would typically be created through the auth system)
INSERT INTO users (id, email, full_name, role, department) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'admin@company.com', 'System Administrator', 'admin', 'IT'),
  ('550e8400-e29b-41d4-a716-446655440002', 'manager@company.com', 'John Manager', 'manager', 'Operations'),
  ('550e8400-e29b-41d4-a716-446655440003', 'employee1@company.com', 'Alice Employee', 'employee', 'Client Services'),
  ('550e8400-e29b-41d4-a716-446655440004', 'employee2@company.com', 'Bob Employee', 'employee', 'Client Services'),
  ('550e8400-e29b-41d4-a716-446655440005', 'viewer@company.com', 'Carol Viewer', 'viewer', 'Reporting')
ON CONFLICT (email) DO NOTHING;

-- Function to handle user login from auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'employee'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    last_login = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();