'use client';

import { useAuth } from '../components/AuthProvider';
import UserManagement from '../components/UserManagement';
import Layout from '../components/Layout';
import LoginForm from '../components/LoginForm';

export default function UsersPage() {
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
      <UserManagement />
    </Layout>
  );
}