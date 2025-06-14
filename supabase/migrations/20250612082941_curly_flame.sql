/*
  # Add Client Status Workflow

  1. New Columns
    - `status` (text, default 'application_form_sent')
      - Workflow stages: application_form_sent -> application_form_received -> draft_verified -> draft_approved -> certification_sent -> completed_won/completed_lost

  2. Changes
    - Add status column to clients table with predefined workflow values
    - Add check constraint to ensure valid status values
    - Update existing records to have default status

  3. Security
    - No changes to existing RLS policies
*/

-- Add status column to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'status'
  ) THEN
    ALTER TABLE clients ADD COLUMN status text DEFAULT 'application_form_sent';
  END IF;
END $$;

-- Add check constraint for valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'clients_status_check'
  ) THEN
    ALTER TABLE clients ADD CONSTRAINT clients_status_check 
    CHECK (status IN (
      'application_form_sent',
      'application_form_received', 
      'draft_verified',
      'draft_approved',
      'certification_sent',
      'completed_won',
      'completed_lost'
    ));
  END IF;
END $$;

-- Update existing records to have default status
UPDATE clients SET status = 'application_form_sent' WHERE status IS NULL;