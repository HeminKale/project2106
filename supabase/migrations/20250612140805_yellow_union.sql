/*
  # Create Channel Partners and Billing System

  1. New Tables
    - `channel_partners`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `country` (text)
      - `phone` (text)
      - `email` (text, unique)
      - `billing_rate` (decimal)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `billing`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `amount` (decimal, required)
      - `billing_date` (date, required)
      - `due_date` (date)
      - `status` (text, default 'pending')
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Client Table Updates
    - `referred_by` (uuid, foreign key to channel_partners)
    - `certification_date` (date)
    - `renewal_date` (date)
    - `iso_standard` (text)
    - `draft_file_url` (text)
    - `certificate_file_url` (text)

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for CRUD operations
*/

-- Create channel_partners table
CREATE TABLE IF NOT EXISTS channel_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  phone text,
  email text UNIQUE,
  billing_rate decimal(10,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create billing table
CREATE TABLE IF NOT EXISTS billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  billing_date date NOT NULL,
  due_date date,
  status text DEFAULT 'pending',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add new columns to clients table
DO $$
BEGIN
  -- Add referred_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE clients ADD COLUMN referred_by uuid REFERENCES channel_partners(id);
  END IF;

  -- Add certification_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'certification_date'
  ) THEN
    ALTER TABLE clients ADD COLUMN certification_date date;
  END IF;

  -- Add renewal_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'renewal_date'
  ) THEN
    ALTER TABLE clients ADD COLUMN renewal_date date;
  END IF;

  -- Add iso_standard column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'iso_standard'
  ) THEN
    ALTER TABLE clients ADD COLUMN iso_standard text;
  END IF;

  -- Add draft_file_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'draft_file_url'
  ) THEN
    ALTER TABLE clients ADD COLUMN draft_file_url text;
  END IF;

  -- Add certificate_file_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'certificate_file_url'
  ) THEN
    ALTER TABLE clients ADD COLUMN certificate_file_url text;
  END IF;
END $$;

-- Add check constraint for billing status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'billing_status_check'
  ) THEN
    ALTER TABLE billing ADD CONSTRAINT billing_status_check 
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'));
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE channel_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

-- Create policies for channel_partners
CREATE POLICY "Users can manage channel partners"
  ON channel_partners
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can read channel partners"
  ON channel_partners
  FOR SELECT
  TO anon
  USING (true);

-- Create policies for billing
CREATE POLICY "Users can manage billing"
  ON billing
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at triggers
CREATE TRIGGER update_channel_partners_updated_at 
    BEFORE UPDATE ON channel_partners 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_updated_at 
    BEFORE UPDATE ON billing 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample channel partners
INSERT INTO channel_partners (name, country, phone, email, billing_rate) VALUES
  ('Global Tech Solutions', 'USA', '+1-555-0123', 'contact@globaltech.com', 150.00),
  ('European Consulting Group', 'Germany', '+49-30-12345678', 'info@ecg-consulting.de', 120.00),
  ('Asia Pacific Partners', 'Singapore', '+65-6123-4567', 'partners@asiapacific.sg', 100.00),
  ('Nordic Business Network', 'Sweden', '+46-8-123-4567', 'hello@nordicbiz.se', 130.00),
  ('Latin America Connect', 'Brazil', '+55-11-9876-5432', 'contato@laconnect.com.br', 90.00)
ON CONFLICT (email) DO NOTHING;