import { createClient, User as SupabaseAuthUser } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Our custom User interface, now based on the public.users table (profile data)
export interface User {
  id: string; // This will link to auth.users.id
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'employee' | 'viewer';
  department: string | null;
  is_active: boolean;
  last_login: string | null; // This will be updated by a DB trigger or manually from auth.users
  created_at: string;
  updated_at: string;
}

// AuthUser interface to combine Supabase session user and our profile User
export interface AuthUser {
  id: string; // The auth.uid()
  email: string | null; // From auth.user, can be null for some auth methods
  user: User | null; // Our public.users profile data
}

// Removed DEMO_PASSWORD and DEMO_USERS as we will use Supabase Auth directly

// Test Supabase connection remains the same
const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    console.log('🔗 Testing Supabase connection...');
    console.log('🔗 URL:', supabaseUrl);
    console.log('🔗 Key (first 20 chars):', supabaseKey.substring(0, 20) + '...');
    
    // Test by selecting from a known public table, e.g., 'clients' or 'users'
    // if 'users' table has RLS, this might fail, but for general connection it's okay
    const { data, error } = await supabase
      .from('users') 
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err);
    return false;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    console.log('🔐 Attempting Supabase sign in for:', email);

    // Use Supabase's native signInWithPassword
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Supabase signInWithPassword data:', data);

    if (error) {
      console.error('❌ Supabase sign in error:', error.message);
      return { 
        data: null, 
        error: { message: error.message || 'Invalid credentials' } 
      };
    }

    if (!data.user) {
      console.error('❌ Supabase sign in succeeded but no user data returned.');
      return { 
        data: null, 
        error: { message: 'Sign in failed: No user data.' } 
      };
    }

    // Fetch the user's profile from your public.users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id) // Link auth.users.id to public.users.id
      .single();

    if (profileError || !userProfile) {
      console.error('⚠️ Could not fetch user profile from public.users:', profileError?.message);
      // Optionally, handle users without a profile (e.g., redirect to profile creation)
      // For now, return a partial AuthUser
      return { 
        data: { 
          user: { 
            id: data.user.id,
            email: data.user.email,
            user: null // No profile data yet
          }
        }, 
        error: { message: 'User profile missing. Please contact support.' } 
      };
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email || null,
      user: userProfile
    };

    localStorage.setItem('auth_user', JSON.stringify(authUser));

    console.log('✅ Supabase Sign in successful for:', userProfile.full_name);

    return { 
      data: { user: authUser }, 
      error: null 
    };
  } catch (err) {
    console.error('❌ Unexpected sign in error:', err);
    return { 
      data: null, 
      error: { message: 'An unexpected error occurred during sign in' } 
    };
  }
};

export const signOut = async () => {
  try {
    console.log('🚪 Signing out from Supabase...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('❌ Supabase sign out error:', error.message);
    }
  } catch (err) {
    console.error('❌ Unexpected sign out error:', err);
  }
  localStorage.removeItem('auth_user');
  return { error: null };
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    console.log('🔄 Getting current Supabase session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ getSession error:', sessionError.message);
      localStorage.removeItem('auth_user');
      return null;
    }
    
    if (!session) {
      console.log('⚠️ No active Supabase session found.');
      localStorage.removeItem('auth_user'); // Clear local storage if no session
      return null;
    }

    // Fetch the user's profile from your public.users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('⚠️ Could not fetch user profile for session:', profileError?.message);
      localStorage.removeItem('auth_user'); // Clear local storage if profile missing
      return null; // No complete user profile
    }

    const authUser: AuthUser = {
      id: session.user.id,
      email: session.user.email || null,
      user: userProfile
    };

    localStorage.setItem('auth_user', JSON.stringify(authUser));
    console.log('✅ Current Supabase user session active and profile loaded.');
    return authUser;

  } catch (err) {
    console.error('❌ Error getting current user:', err);
    localStorage.removeItem('auth_user');
    return null;
  }
};

export const getUsers = async () => {
  console.log('📋 Fetching all users...');
  
  // For admin view, fetch from public.users which holds profile data
  const { data, error: dbError } = await supabase
    .from('users')
    .select('id, email, full_name, role, department, is_active, created_at, updated_at, last_login') // Select specific fields
    .order('created_at', { ascending: false });

  console.log('📋 Supabase users fetch result:', { data, error: dbError });
  
  if (!dbError && data) {
    return { data, error: null };
  }
  
  console.error('❌ Failed to fetch users:', dbError?.message);
  return { data: [], error: dbError || { message: 'Failed to fetch users' } };
};

export const createUser = async (userData: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  department?: string;
}) => {
  console.log('👤 Attempting to create new user in Supabase Auth and public.users:', userData.email);
  
  try {
    // 1. Create user in Supabase Auth
    const { data: authSignUpData, error: authSignUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: { full_name: userData.full_name, role: userData.role, department: userData.department },
      },
    });

    if (authSignUpError) {
      console.error('❌ Supabase Auth signup error:', authSignUpError.message);
      throw new Error(authSignUpError.message);
    }

    if (!authSignUpData.user) {
      throw new Error('Supabase Auth signup succeeded but no user returned.');
    }

    const newAuthUserId = authSignUpData.user.id;

    console.log('Attempting to insert profile into public.users for auth user ID:', newAuthUserId);

    // 2. Insert profile into public.users table, linking to auth.users.id
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert({
        id: newAuthUserId, // Link to auth.users.id
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        department: userData.department || null,
        is_active: true,
        last_login: null // Supabase Auth handles this implicitly, or a trigger can sync
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Error creating user profile in public.users:', profileError.message);
      // If the profile creation fails, it's crucial to delete the auth user to prevent orphaned entries.
      // This operation requires a service role key if executed on the server. If run client-side,
      // direct deletion of auth.users is often restricted for security. A backend function/webhook
      // might be needed for robust rollback.
      const { error: deleteAuthUserError } = await supabase.auth.admin.deleteUser(newAuthUserId);
      if (deleteAuthUserError) {
        console.error('❌ Error deleting auth user after profile creation failure:', deleteAuthUserError.message);
        // If auth user deletion also fails, log it but proceed with original profile error
      }
      throw new Error(profileError.message);
    }

    console.log('✅ User created successfully in Supabase Auth and public.users:', profileData);
    return { data: profileData as User, error: null };

  } catch (err) {
    console.error('❌ Unexpected error during user creation:', err);
    let errorMessage = 'An unexpected error occurred during user creation';
    if (err instanceof Error) {
      if (err.message.includes('users_email_key')) {
        errorMessage = 'A user with this email already exists.';
      } else if (err.message.includes('users_pkey')) {
        errorMessage = 'A user with this ID already exists. This might be a partial creation from a previous attempt.';
      }
      errorMessage = err.message;
    }
    return { 
      data: null, 
      error: { message: errorMessage } 
    };
  }
};

export const updateUser = async (userId: string, updates: Partial<User>) => {
  console.log('🔄 Attempting to update user:', userId, updates);
  try {
    // Update profile in public.users
    const { data, error: dbError } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (dbError) {
      console.error('❌ Error updating user profile:', dbError.message);
      return { data: null, error: { message: dbError.message } };
    }

    console.log('✅ User profile updated:', data);
    return { data, error: null };

  } catch (err) {
    console.error('❌ Unexpected error during user update:', err);
    return { 
      data: null, 
      error: { message: err instanceof Error ? err.message : 'An unexpected error occurred during user update' } 
    };
  }
};

export const deleteUser = async (userId: string, hardDelete: boolean = false) => {
  console.log(`🗑️ Attempting to ${hardDelete ? 'hard delete' : 'deactivate'} user:`, userId);
  try {
    if (hardDelete) {
      // Hard delete: Remove from both public.users and Supabase Auth
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        console.error('❌ Error deleting user from public.users:', deleteError.message);
        return { error: deleteError };
      }

      // Delete from Supabase Auth
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
      if (authDeleteError) {
        console.error('❌ Supabase Auth user delete error:', authDeleteError.message);
        return { error: authDeleteError };
      }

      console.log('✅ User hard deleted successfully:', userId);
    } else {
      // Soft delete: Just deactivate the user
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Error inactivating user:', updateError.message);
        return { error: updateError };
      }

      console.log('✅ User deactivated successfully:', userId);
    }

    return { error: null };

  } catch (err) {
    console.error('❌ Unexpected error during user deletion:', err);
    return { error: { message: err instanceof Error ? err.message : 'An unexpected error occurred during user deletion' } };
  }
};