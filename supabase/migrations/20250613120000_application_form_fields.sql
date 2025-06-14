-- Create enum for ISO standard types
CREATE TYPE iso_standard_type AS ENUM (
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2013',
  'ISO 22000:2018',
  'ISO 13485:2016',
  'ISO 50001:2018'
);

-- Create table for application form fields
CREATE TABLE application_form_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_no TEXT NOT NULL,
  address TEXT NOT NULL,
  country TEXT NOT NULL,
  scope TEXT NOT NULL,
  website TEXT,
  iso_standard iso_standard_type NOT NULL,
  years_required INTEGER NOT NULL,
  director_name TEXT NOT NULL,
  company_registration_no TEXT NOT NULL,
  company_registration_date DATE NOT NULL,
  employee1_name TEXT NOT NULL,
  employee1_designation TEXT NOT NULL,
  employee2_name TEXT NOT NULL,
  employee2_designation TEXT NOT NULL,
  employee3_name TEXT NOT NULL,
  employee3_designation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for draft mapping
CREATE TABLE draft_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iso_standard iso_standard_type NOT NULL,
  system_type TEXT NOT NULL, -- e.g., 'Quality management system', 'Food management system'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default mappings for ISO standards
INSERT INTO draft_mappings (iso_standard, system_type) VALUES
  ('ISO 9001:2015', 'Quality management system'),
  ('ISO 14001:2015', 'Environmental management system'),
  ('ISO 45001:2018', 'Occupational health and safety management system'),
  ('ISO 27001:2013', 'Information security management system'),
  ('ISO 22000:2018', 'Food safety management system'),
  ('ISO 13485:2016', 'Medical devices quality management system'),
  ('ISO 50001:2018', 'Energy management system');

-- Add RLS policies
ALTER TABLE application_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for application_form_fields
CREATE POLICY "Users can view their own application form fields"
  ON application_form_fields FOR SELECT
  USING (auth.uid() IN (
    SELECT created_by FROM clients WHERE id = application_form_fields.client_id
  ));

CREATE POLICY "Users can insert their own application form fields"
  ON application_form_fields FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT created_by FROM clients WHERE id = application_form_fields.client_id
  ));

CREATE POLICY "Users can update their own application form fields"
  ON application_form_fields FOR UPDATE
  USING (auth.uid() IN (
    SELECT created_by FROM clients WHERE id = application_form_fields.client_id
  ));

-- Create policies for draft_mappings
CREATE POLICY "Anyone can view draft mappings"
  ON draft_mappings FOR SELECT
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_application_form_fields_updated_at
  BEFORE UPDATE ON application_form_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_draft_mappings_updated_at
  BEFORE UPDATE ON draft_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for drafts
INSERT INTO storage.buckets (id, name, public) VALUES ('drafts', 'drafts', false);

-- Create storage bucket for application forms
INSERT INTO storage.buckets (id, name, public) VALUES ('application_forms', 'application_forms', false);

-- Create storage policy for drafts
CREATE POLICY "Users can upload their own drafts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'drafts' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY "Users can view their own drafts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'drafts' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY "Users can update their own drafts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'drafts' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY "Users can delete their own drafts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'drafts' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  );

-- Create storage policy for application forms
CREATE POLICY "Users can upload their own application forms"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'application_forms' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY "Users can view their own application forms"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'application_forms' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY "Users can update their own application forms"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'application_forms' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  );

CREATE POLICY "Users can delete their own application forms"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'application_forms' AND
    auth.uid() IN (
      SELECT created_by FROM clients WHERE id = (storage.foldername(name))[1]::uuid
    )
  ); 