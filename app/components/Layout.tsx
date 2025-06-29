'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from './AuthProvider';

interface LayoutProps {
  children: React.ReactNode;
}

interface TabEntry {
  id: string;
  label: string;
}

export default function Layout({ children }: LayoutProps) {
  const [tabs, setTabs] = useState<TabEntry[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const { user, refreshUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Load tabs from Supabase
  useEffect(() => {
    const fetchTabs = async () => {
      const { data, error } = await supabase
        .from('tabs')
        .select('api_name, name, is_visible, display_order')
        .eq('is_visible', true)
        .order('display_order');

      console.log('Tabs data:', data, 'Error:', error);

      if (!error && data) {
        const mappedTabs = (data || []).map((tab: any) => ({
          id: tab.api_name,
          label: tab.name
        }));
        setTabs(mappedTabs);
      }
    };

    fetchTabs();
  }, []);

  // Set active tab based on pathname
  useEffect(() => {
    const match = tabs.find(tab => pathname.startsWith(`/${tab.id}`));
    if (match) {
      setActiveTab(match.id);
    }
  }, [pathname, tabs]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/${tabId}`);
  };

  // Role-based filtering (optional, you can adjust this logic)
  const getVisibleTabs = () => {
    if (!user?.user) return tabs;

    const userRole = user.user.role;
    if (userRole === 'viewer') {
      return tabs.filter(tab =>
        ['clients', 'channel-partners', 'billing', 'dashboard', 'reports'].includes(tab.id)
      );
    }
    if (userRole === 'employee') {
      return tabs.filter(tab =>
        !['users', 'settings'].includes(tab.id)
      );
    }
    return tabs; // manager/admin
  };

  const visibleTabs = getVisibleTabs();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Horizontal Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <nav className="flex space-x-4 px-6 py-4">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Page Content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}