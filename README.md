# Client Management App

A Next.js application with Supabase integration for managing clients.

## Setup Instructions

1. **Supabase Setup**:
   - Click the "Connect to Supabase" button in the top right to set up your Supabase project
   - The database schema will be automatically created with the migration file

2. **Environment Variables**:
   - Update `.env.local` with your actual Supabase credentials
   - Get these from your Supabase project dashboard

3. **Features**:
   - Create new clients with name, email, and channel partner ID
   - Form validation with error handling
   - Responsive design with Tailwind CSS
   - Real-time feedback on form submission

## Database Schema

The `clients` table includes:
- `id`: Unique identifier
- `name`: Client name
- `email`: Client email (unique)
- `draft_uploaded`: Boolean flag for draft status
- `certificate_sent`: Boolean flag for certificate status
- `channel_partner_id`: Associated channel partner
- `created_at` / `updated_at`: Timestamps

## Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.