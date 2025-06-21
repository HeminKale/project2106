'use client';

import { useAuth } from './components/AuthProvider';
import LoginForm from './components/LoginForm';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/clients');
    }
  }, [user, loading, router]);

  if (!user) {
    return <LoginForm />;
  }

  return null;
}