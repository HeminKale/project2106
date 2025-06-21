'use client';

import { useAuth } from '../../components/AuthProvider';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Layout from '../../components/Layout';
import ChannelPartnerBillingManager from '../../components/ChannelPartnerBillingManager';
import LoginForm from '../../components/LoginForm';
import Link from 'next/link';
import ChannelPartnerClientsList from '../../components/ChannelPartnerClientsList';

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

interface FieldMetadata {
  id: string;
  table_name: string;
  api_name: string;
  display_label: string;
  field_type: string;
  is_required: boolean;
  is_nullable: boolean;
  default_value: string | null;
  validation_rules: any[];
  display_order: number;
  section: string;
  width: 'half' | 'full';
  is_visible: boolean;
  is_system_field: boolean;
  reference_table: string | null;
  reference_display_field: string | null;
}

const tabs = [
  { id: 'information', label: 'Partner Information', icon: '🤝' },
  { id: 'clients', label: 'Clients', icon: '👥' },
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
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata[]>([]);

  useEffect(() => {
    if (params.id && user) {
      fetchPartner(params.id as string);
      fetchFieldMetadata();
    }
  }, [params.id, user]);

  useEffect(() => {
    if (partner) {
      setEditedPartner({ ...partner });
    }
  }, [partner]);

  const fetchFieldMetadata = async () => {
    try {
      console.log('🔍 Fetching field metadata for channel_partners table');
      const { data, error } = await supabase
        .from('field_metadata')
        .select('*')
        .eq('table_name', 'channel_partners')
        .order('display_order');

      if (error) {
        console.error('❌ Error fetching field metadata:', error);
      } else {
        console.log('✅ Fetched field metadata:', data);
        if (!data || data.length === 0) {
          console.log('No field metadata found, syncing...');
          await syncFieldMetadata();
        } else {
          setFieldMetadata(data);
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching field metadata:', err);
    }
  };

  const syncFieldMetadata = async () => {
    try {
      console.log('🔄 Syncing field metadata for channel_partners table');
      const { data, error } = await supabase.rpc('sync_table_metadata', {
        table_name_param: 'channel_partners'
      });

      if (error) {
        console.error('❌ Error syncing field metadata:', error);
      } else {
        console.log('✅ Field metadata synced:', data);
        // Fetch the metadata again after syncing
        fetchFieldMetadata();
      }
    } catch (err) {
      console.error('Unexpected error syncing field metadata:', err);
    }
  };

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

  // Add helper function to get fields for a section
  const getFieldsForSection = (section: string) => {
    const fields = fieldMetadata
      .filter(field => field.section === section && field.is_visible)
      .sort((a, b) => a.display_order - b.display_order);
    console.log(`Fields for section ${section}:`, fields);
    return fields;
  };

  // Add helper function to render field value
  const renderFieldValue = (field: FieldMetadata, value: any) => {
    if (value === null || value === undefined) return 'N/A';

    switch (field.field_type) {
      case 'date':
      case 'timestamptz':
        return formatDate(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'reference':
        // For channel partners, we might not have specific reference display logic like 'referred_by' in clients
        // If there's a specific reference field for channel partners, add logic here
        return value;
      default:
        return value;
    }
  };

  // Add helper function to render field input
  const renderFieldInput = (field: FieldMetadata, value: any) => {
    const handleChange = (newValue: any) => {
      if (editedPartner) {
        setEditedPartner({ ...editedPartner, [field.api_name as keyof ChannelPartner]: newValue } as ChannelPartner);
      }
    };

    switch (field.field_type) {
      case 'date':
      case 'timestamptz':
        return (
          <input
            type="date"
            value={value ? value.substring(0, 10) : ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
      case 'boolean':
        return (
          <select
            value={value ? 'true' : 'false'}
            onChange={(e) => handleChange(e.target.value === 'true')}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      case 'reference':
        // Handle reference fields if needed, for now a text input
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
      case 'number':
      case 'integer':
      case 'decimal':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
      case 'text':
      case 'varchar':
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
    }
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
              </div>
              <div className="flex space-x-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Edit Partner
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
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
              <div className="space-y-8 p-6">
                {/* Dynamic Sections */}
                {(() => {
                  const uniqueSections = Array.from(new Set(fieldMetadata.map(f => f.section)));
                  const predefinedOrder = ['basic', 'details', 'system'];

                  const sortedSections = uniqueSections.sort((a, b) => {
                    const indexA = predefinedOrder.indexOf(a);
                    const indexB = predefinedOrder.indexOf(b);

                    if (indexA === -1 && indexB === -1) {
                      return a.localeCompare(b); // Both are custom, sort alphabetically
                    }
                    if (indexA === -1) {
                      return 1; // a is custom, b is predefined, b comes first
                    }
                    if (indexB === -1) {
                      return -1; // a is predefined, b is custom, a comes first
                    }
                    return indexA - indexB; // Sort by predefined order
                  });

                  return sortedSections.map(section => {
                    const fields = getFieldsForSection(section);
                    if (fields.length === 0) return null;

                    return (
                      <div key={section} className="space-y-4">
                        <h2 className="text-lg font-bold text-gray-900">
                          {section.charAt(0).toUpperCase() + section.slice(1)}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                          {fields.map(field => (
                            <div key={field.id} className={field.width === 'full' ? 'col-span-2' : ''}>
                              <p className="text-sm font-medium text-gray-500">{field.display_label}</p>
                              {!isEditing ? (
                                <p className="mt-1 text-sm text-gray-900">
                                  {renderFieldValue(field, partner[field.api_name as keyof ChannelPartner])}
                                </p>
                              ) : (
                                renderFieldInput(field, editedPartner?.[field.api_name as keyof ChannelPartner])
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Clients Tab */}
            {activeTab === 'clients' && partner && (
              <div className="mt-8 bg-white rounded-lg shadow-xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Clients Referred by {partner.name}</h2>
                <ChannelPartnerClientsList channelPartnerId={partner.id} />
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