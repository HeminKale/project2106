'use client';

import { useAuth } from '../../components/AuthProvider';
import ClientForm from '../../components/ClientForm';
import Layout from '../../components/Layout';
import LoginForm from '../../components/LoginForm';
import Link from 'next/link';

export default function NewClientPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/clients" 
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Clients
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create New Client</h1>
          <p className="text-gray-600">Add a new client to your system</p>
        </div>
        <ClientForm />
      </div>
    </Layout>
  );
}