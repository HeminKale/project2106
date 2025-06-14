'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { signIn } from '../lib/auth';
import { useAuth } from './AuthProvider';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'demo'>('checking');
  const { refreshUser } = useAuth();

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError('');

    console.log('🔐 Login attempt for:', data.email);

    try {
      const { data: result, error: signInError } = await signIn(data.email, data.password);
      
      console.log('🔐 Sign in result:', { result, signInError });
      
      if (signInError) {
        console.log('❌ Sign in error:', signInError.message);
        setError(signInError.message);
      } else {
        console.log('✅ Sign in successful, refreshing user...');
        await refreshUser();
      }
    } catch (err) {
      console.error('❌ Unexpected login error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Client Management System
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {connectionStatus === 'checking' && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              )}
              {connectionStatus === 'connected' && (
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {connectionStatus === 'demo' && (
                <svg className="h-5 w-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                {connectionStatus === 'checking' && 'Checking database connection...'}
                {connectionStatus === 'connected' && '✅ Connected to Supabase database'}
                {connectionStatus === 'demo' && '⚠️ Running in demo mode (database not available)'}
              </p>
            </div>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Please enter a valid email address'
                  }
                })}
                type="email"
                autoComplete="email"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                {...register('password', { required: 'Password is required' })}
                type="password"
                autoComplete="current-password"
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        {/* Demo credentials */}
        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Demo Credentials:</h3>
          <div className="text-xs text-blue-700 space-y-1">
            <div><strong>Admin:</strong> admin@company.com / password123</div>
            <div><strong>Manager:</strong> manager@company.com / password123</div>
            <div><strong>Employee:</strong> employee1@company.com / password123</div>
            <div><strong>Employee:</strong> employee2@company.com / password123</div>
            <div><strong>Viewer:</strong> viewer@company.com / password123</div>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            💡 All demo users use the same password: <strong>password123</strong>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <details>
            <summary className="text-xs text-gray-600 cursor-pointer">
              🔧 Troubleshooting (Click to expand)
            </summary>
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <p>• Check the browser console (F12) for detailed error information</p>
              <p>• Verify your Supabase credentials in .env.local</p>
              <p>• The system will work in demo mode even if Supabase is unavailable</p>
              <p>• All demo users use password: <strong>password123</strong></p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}