'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, AuthUser } from '../lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  impersonatedUserName: string | null;
  setImpersonatedUserName: (name: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  impersonatedUserName: null,
  setImpersonatedUserName: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('impersonatedUserName');
    }
    return null;
  });

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (impersonatedUserName) {
        localStorage.setItem('impersonatedUserName', impersonatedUserName);
      } else {
        localStorage.removeItem('impersonatedUserName');
      }
    }
  }, [impersonatedUserName]);

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, impersonatedUserName, setImpersonatedUserName }}>
      {children}
    </AuthContext.Provider>
  );
}