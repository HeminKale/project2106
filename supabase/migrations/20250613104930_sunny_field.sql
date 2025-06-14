/*
  # Add Channel Partner to Billing

  1. Changes
    - Add `channel_partner_id` column to billing table
    - Add foreign key constraint to channel_partners table
    - Update existing billing records to set channel_partner_id based on client's referred_by

  2. Security
    - No changes to existing RLS policies
*/

-- Add channel_partner_id column to billing table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'billing' AND column_name = 'channel_partner_id'
  ) THEN
    ALTER TABLE billing ADD COLUMN channel_partner_id uuid REFERENCES channel_partners(id);
  END IF;
END $$;

-- Update existing billing records to set channel_partner_id based on client's referred_by
UPDATE billing 
SET channel_partner_id = clients.referred_by
FROM clients 
WHERE billing.client_id = clients.id 
AND clients.referred_by IS NOT NULL 
AND billing.channel_partner_id IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_billing_channel_partner_id ON billing(channel_partner_id);