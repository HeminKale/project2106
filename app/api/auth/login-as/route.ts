import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ensure environment variables are set
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Initialize Supabase client with service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Sign in as the user using the service role key
    const { data, error } = await (supabaseAdmin.auth.admin as any).signInAsUser(
      userId,
      { redirectTo: '/users' } // Redirect to the users page after successful login
    );

    if (error) {
      console.error('Error signing in as user:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the new session or a success message
    return NextResponse.json({ success: true, session: data.session }, { status: 200 });

  } catch (err: any) {
    console.error('Unexpected error in login-as API:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 