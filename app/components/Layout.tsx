'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TabNavigation from './TabNavigation';
import ChannelPartnerList from './ChannelPartnerList';
import BillingList from './BillingList';
import UserManagement from './UserManagement';
import SettingsManager from './SettingsManager';
import { useAuth } from './AuthProvider';
import { signOut } from '../lib/auth';

interface LayoutProps {
  children: React.ReactNode;
}

const tabs = [
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'channel-partners', label: 'Channel Partners', icon: '🤝' },
  { id: 'billing', label: 'Billing', icon: '💰' },
  { id: 'users', label: 'Users', icon: '👤' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ children }: LayoutProps) {
  const [activeTab, setActiveTab] = useState('clients');
  const { user, refreshUser, impersonatedUserName, setImpersonatedUserName } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Update active tab based on current pathname
  useEffect(() => {
    if (pathname.startsWith('/clients')) {
      setActiveTab('clients');
    } else if (pathname.startsWith('/channel-partners')) {
      setActiveTab('channel-partners');
    } else if (pathname.startsWith('/billing')) {
      setActiveTab('billing');
    } else if (pathname.startsWith('/users')) {
      setActiveTab('users');
    } else if (pathname.startsWith('/dashboard')) {
      setActiveTab('dashboard');
    } else if (pathname.startsWith('/reports')) {
      setActiveTab('reports');
    } else if (pathname.startsWith('/settings')) {
      setActiveTab('settings');
    }
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    await refreshUser();
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Navigate to the appropriate route
    if (tabId === 'clients') {
      router.push('/clients');
    } else if (tabId === 'channel-partners') {
      router.push('/channel-partners');
    } else if (tabId === 'billing') {
      router.push('/billing');
    } else if (tabId === 'users') {
      router.push('/users');
    } else if (tabId === 'dashboard') {
      router.push('/dashboard');
    } else if (tabId === 'reports') {
      router.push('/reports');
    } else if (tabId === 'settings') {
      router.push('/settings');
    }
  };

  // Filter tabs based on user role
  const getVisibleTabs = () => {
    if (!user?.user) return tabs.filter(tab => ['clients', 'dashboard'].includes(tab.id));
    
    const userRole = user.user.role;
    
    if (userRole === 'viewer') {
      return tabs.filter(tab => ['clients', 'channel-partners', 'billing', 'dashboard', 'reports'].includes(tab.id));
    }
    
    if (userRole === 'employee') {
      return tabs.filter(tab => !['users', 'settings'].includes(tab.id));
    }
    
    // Manager and Admin can see all tabs
    return tabs;
  };

  const visibleTabs = getVisibleTabs();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Client Management System</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user?.user && (
                <>
                  {impersonatedUserName && (
                    <div className="text-sm text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full mr-4 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      Logged in as <span className="font-semibold">{impersonatedUserName}</span>
                      <button
                        onClick={() => {
                          setImpersonatedUserName(null);
                          localStorage.removeItem('impersonatedUserName');
                          window.location.href = '/';
                        }}
                        className="ml-2 text-yellow-800 hover:text-yellow-900 focus:outline-none"
                      >
                        (Exit Impersonation)
                      </button>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user.user.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="text-gray-900">{user.user.full_name}</div>
                      <div className="text-gray-500 capitalize">{user.user.role}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <TabNavigation 
        tabs={visibleTabs} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Always render children - this will be the page-specific content */}
        {children}
      </main>
    </div>
  );
}