'use client';

import { useAuth } from '../components/AuthProvider';
import UserManagement from '../components/UserManagement';
import Layout from '../components/Layout';
import LoginForm from '../components/LoginForm';

export default function UsersPage() {
  const { user, loading } = useAuth();

  if (!user) {
    return <LoginForm />;
  }

  return (
    <Layout>
      <UserManagement />
    </Layout>
  );
}