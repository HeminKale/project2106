'use client';

import { useAuth } from '../components/AuthProvider';
import Layout from '../components/Layout';
import LoginForm from '../components/LoginForm';
import Link from 'next/link';

export default function DashboardPage() {
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
      <div className="max-w-4xl mx-auto py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎉 Welcome to Your Fresh Start!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your dynamic admin system is ready to be configured
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-2xl">⚙️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Object Manager</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Create and configure your business objects with dynamic fields and layouts.
            </p>
            <Link 
              href="/settings"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Settings
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                <span className="text-2xl">📋</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Dynamic System</h3>
            </div>
            <p className="text-gray-600 mb-4">
              All objects use the same dynamic system - no more custom code for each object!
            </p>
            <div className="text-sm text-gray-500">
              ✅ Consistent UI/UX<br/>
              ✅ Dynamic layouts<br/>
              ✅ Configurable fields<br/>
              ✅ Persistent views
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🚀 Getting Started</h3>
          <ol className="text-blue-800 space-y-2">
            <li className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
              <span>Go to <strong>Settings → Object Manager</strong> to create your first object</span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
              <span>Configure fields and layouts for your object</span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
              <span>Add the object to navigation in <strong>Settings → Tab Settings</strong></span>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">4</span>
              <span>Start using your new dynamic object!</span>
            </li>
          </ol>
        </div>
      </div>
    </Layout>
  );
} 