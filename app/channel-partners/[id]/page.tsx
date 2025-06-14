'use client';

import { useAuth } from '../../components/AuthProvider';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Layout from '../../components/Layout';
import ChannelPartnerBillingManager from '../../components/ChannelPartnerBillingManager';
import LoginForm from '../../components/LoginForm';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

type ChannelPartner = {
  id: string;
  name: string;
  country: string;
  phone: string | null;
  email: string | null;
  billing_rate: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  creator?: {
    full_name: string;
    email: string;
  };
  updater?: {
    full_name: string;
    email: string;
  };
};

const tabs = [
  { id: 'information', label: 'Partner Information', icon: '🤝' },
  { id: 'billing', label: 'Billing Management', icon: '💰' }
];

export default function ChannelPartnerDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const [partner, setPartner] = useState<ChannelPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedPartner, setEditedPartner] = useState<ChannelPartner | null>(null);
  const [activeTab, setActiveTab] = useState('information');

  useEffect(() => {
    if (params.id && user) {
      fetchPartner(params.id as string);
    }
  }, [params.id, user]);

  useEffect(() => {
    if (partner) {
      setEditedPartner({ ...partner });
    }
  }, [partner]);

  const fetchPartner = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('channel_partners')
        .select(`
          *,
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Supabase error:', error);
        setError(error.message);
      } else {
        console.log('✅ Fetched channel partner:', data);
        setPartner(data);
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedPartner || !partner) return;
    
    setSaving(true);
    try {
      const updateData = {
        name: editedPartner.name,
        country: editedPartner.country,
        phone: editedPartner.phone,
        email: editedPartner.email,
        billing_rate: editedPartner.billing_rate,
        updated_at: new Date().toISOString()
      };

      const { data: updateResult, error: updateError } = await supabase
        .from('channel_partners')
        .update(updateData)
        .eq('id', partner.id)
        .select(`
          *,
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        alert('Error saving changes: ' + updateError.message);
        return;
      }

      if (updateResult && updateResult.length > 0) {
        const updatedPartner = updateResult[0];
        setPartner(updatedPartner);
        setEditedPartner(updatedPartner);
        setIsEditing(false);
        alert('Changes saved successfully!');
      }

    } catch (err) {
      console.error('❌ Unexpected save error:', err);
      alert('An unexpected error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedPartner(partner ? { ...partner } : null);
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'Not set';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading channel partner details...</span>
        </div>
      </Layout>
    );
  }

  if (error || !partner || !editedPartner) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Channel partner not found</h3>
                <p className="mt-1 text-sm text-red-700">{error || 'The requested channel partner could not be found.'}</p>
                <Link 
                  href="/channel-partners"
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Back to channel partners list
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/channel-partners" 
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Channel Partners
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
                <p className="text-gray-600">{partner.country}</p>
                {partner.email && (
                  <p className="text-sm text-blue-600">{partner.email}</p>
                )}
                {/* User tracking info */}
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  {partner.creator && (
                    <div>Created by: {partner.creator.full_name} ({partner.creator.email})</div>
                  )}
                  {partner.updater && (
                    <div>Last updated by: {partner.updater.full_name} ({partner.updater.email})</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Interface */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Partner Information Tab */}
            {activeTab === 'information' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Partner Information</h3>
                  
                  {/* Edit/Save/Cancel Buttons */}
                  {user.user?.role !== 'viewer' && (
                    <>
                      {!isEditing ? (
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                          disabled={saving}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={handleSave}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                            disabled={saving}
                          >
                            {saving ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Save
                              </>
                            )}
                          </button>
                          <button 
                            onClick={handleCancel}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                            disabled={saving}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Basic Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Partner Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedPartner.name}
                            onChange={(e) => setEditedPartner({ ...editedPartner, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{partner.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Country</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedPartner.country || ''}
                            onChange={(e) => setEditedPartner({ ...editedPartner, country: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{partner.country || 'Not specified'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                        {isEditing ? (
                          <input
                            type="email"
                            value={editedPartner.email || ''}
                            onChange={(e) => setEditedPartner({ ...editedPartner, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{partner.email || 'Not provided'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                        {isEditing ? (
                          <input
                            type="tel"
                            value={editedPartner.phone || ''}
                            onChange={(e) => setEditedPartner({ ...editedPartner, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{partner.phone || 'Not provided'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Billing Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Billing Rate (USD)</label>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editedPartner.billing_rate || ''}
                            onChange={(e) => setEditedPartner({ ...editedPartner, billing_rate: parseFloat(e.target.value) || null })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{formatCurrency(partner.billing_rate)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Timeline</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
                        <p className="text-sm text-gray-900 py-2">{formatDate(partner.created_at)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Last Updated</label>
                        <p className="text-sm text-gray-900 py-2">{formatDate(partner.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Management Tab */}
            {activeTab === 'billing' && (
              <ChannelPartnerBillingManager 
                channelPartnerId={partner.id} 
                channelPartnerName={partner.name}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}