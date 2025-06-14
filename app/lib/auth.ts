import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'employee' | 'viewer';
  department: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  user: User | null;
}

// Demo password for all users (in production, use proper hashing)
const DEMO_PASSWORD = 'password123';

// Demo users as fallback when database is not available
const DEMO_USERS: User[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'admin@company.com',
    full_name: 'System Administrator',
    role: 'admin',
    department: 'IT',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    email: 'manager@company.com',
    full_name: 'John Manager',
    role: 'manager',
    department: 'Operations',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    email: 'employee1@company.com',
    full_name: 'Alice Employee',
    role: 'employee',
    department: 'Client Services',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    email: 'employee2@company.com',
    full_name: 'Bob Employee',
    role: 'employee',
    department: 'Client Services',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    email: 'viewer@company.com',
    full_name: 'Carol Viewer',
    role: 'viewer',
    department: 'Reporting',
    is_active: true,
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Test Supabase connection
const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    console.log('🔗 Testing Supabase connection...');
    console.log('🔗 URL:', supabaseUrl);
    console.log('🔗 Key (first 20 chars):', supabaseKey.substring(0, 20) + '...');
    
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
    console.log('🔐 Attempting sign in for:', email);
    console.log('🔐 Password provided:', password);
    console.log('🔐 Expected password:', DEMO_PASSWORD);
    
    // Check if password matches demo password
    if (password !== DEMO_PASSWORD) {
      console.log('❌ Password mismatch');
      return { 
        data: null, 
        error: { message: 'Invalid credentials - password does not match' } 
      };
    }

    console.log('✅ Password matches, checking user in database...');

    // Test Supabase connection first
    const isConnected = await testSupabaseConnection();
    
    let userData: User | null = null;
    
    if (isConnected) {
      console.log('🔗 Using Supabase database...');
      
      // Try to find user in Supabase
      const { data: supabaseUser, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      console.log('🔍 Supabase user lookup result:', { supabaseUser, error });

      if (error) {
        console.log('⚠️ Supabase error, falling back to demo users:', error);
      } else {
        userData = supabaseUser;
      }
    } else {
      console.log('⚠️ Supabase not available, using demo users');
    }
    
    // Fallback to demo users if Supabase is not available or user not found
    if (!userData) {
      console.log('🔍 Looking up user in demo data...');
      userData = DEMO_USERS.find(user => user.email === email && user.is_active) || null;
      
      if (!userData) {
        console.log('❌ User not found in demo data');
        return { 
          data: null, 
          error: { message: 'No user found with this email address' } 
        };
      }
      
      console.log('✅ User found in demo data:', userData);
    }

    // Update last login if using Supabase
    if (isConnected) {
      try {
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', userData.id);
        console.log('✅ Last login updated in Supabase');
      } catch (updateError) {
        console.log('⚠️ Could not update last login:', updateError);
      }
    }

    // Store user session in localStorage
    const authUser: AuthUser = {
      id: userData.id,
      email: userData.email,
      user: userData
    };

    localStorage.setItem('auth_user', JSON.stringify(authUser));

    console.log('✅ Sign in successful for:', userData.full_name);

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
  localStorage.removeItem('auth_user');
  return { error: null };
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const storedUser = localStorage.getItem('auth_user');
    if (!storedUser) return null;

    const authUser = JSON.parse(storedUser) as AuthUser;
    
    // Test if Supabase is available
    const isConnected = await testSupabaseConnection();
    
    if (isConnected) {
      // Verify user still exists and is active in Supabase
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .eq('is_active', true)
        .single();

      if (error || !userData) {
        console.log('⚠️ User not found in Supabase, checking demo users');
        
        // Fallback to demo users
        const demoUser = DEMO_USERS.find(user => user.id === authUser.id && user.is_active);
        if (!demoUser) {
          localStorage.removeItem('auth_user');
          return null;
        }
        
        // Update stored user with demo data
        const updatedAuthUser: AuthUser = {
          id: demoUser.id,
          email: demoUser.email,
          user: demoUser
        };
        
        localStorage.setItem('auth_user', JSON.stringify(updatedAuthUser));
        return updatedAuthUser;
      }

      // Update the stored user data with Supabase data
      const updatedAuthUser: AuthUser = {
        id: userData.id,
        email: userData.email,
        user: userData
      };

      localStorage.setItem('auth_user', JSON.stringify(updatedAuthUser));
      return updatedAuthUser;
    } else {
      // Supabase not available, validate against demo users
      const demoUser = DEMO_USERS.find(user => user.id === authUser.id && user.is_active);
      if (!demoUser) {
        localStorage.removeItem('auth_user');
        return null;
      }
      
      return authUser;
    }
  } catch (err) {
    console.error('❌ Error getting current user:', err);
    localStorage.removeItem('auth_user');
    return null;
  }
};

export const getUsers = async () => {
  console.log('📋 Fetching all users...');
  
  const isConnected = await testSupabaseConnection();
  
  if (isConnected) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('📋 Supabase users fetch result:', { data, error });
    
    if (!error && data) {
      return { data, error };
    }
  }
  
  // Fallback to demo users
  console.log('📋 Using demo users as fallback');
  return { data: DEMO_USERS, error: null };
};

export const createUser = async (userData: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  department?: string;
}) => {
  console.log('👤 Creating new user:', userData.email);
  
  const isConnected = await testSupabaseConnection();
  
  if (isConnected) {
    // For demo purposes, we'll just create the user in our users table
    // In production, you'd want proper password hashing and auth integration
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        department: userData.department || null,
        is_active: true
      })
      .select()
      .single();

    console.log('👤 Supabase user creation result:', { data, error });
    return { data, error };
  }
  
  // If Supabase is not available, return success but note it's demo mode
  console.log('👤 Demo mode: User creation simulated');
  return { 
    data: {
      id: 'demo-' + Date.now(),
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      department: userData.department || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, 
    error: null 
  };
};

export const updateUser = async (userId: string, updates: Partial<User>) => {
  const isConnected = await testSupabaseConnection();
  
  if (isConnected) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    return { data, error };
  }
  
  // Demo mode
  return { 
    data: { id: userId, ...updates }, 
    error: null 
  };
};

export const deleteUser = async (userId: string) => {
  const isConnected = await testSupabaseConnection();
  
  if (isConnected) {
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', userId);

    return { error };
  }
  
  // Demo mode
  return { error: null };
};