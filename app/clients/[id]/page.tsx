'use client';

import { useAuth } from '../../components/AuthProvider';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Layout from '../../components/Layout';
import DocumentManager from '../../components/DocumentManager';
import BillingManager from '../../components/BillingManager';
import LoginForm from '../../components/LoginForm';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

type Client = {
  id: string;
  name: string;
  email: string;
  draft_uploaded: boolean;
  certificate_sent: boolean;
  status: string;
  referred_by: string | null;
  certification_date: string | null;
  renewal_date: string | null;
  iso_standard: string | null;
  draft_url: string | null;
  certificate_file_url: string | null;
  application_form_url: string | null;
  Application_form_Date: string | null;
  certificate_number: string | null;
  issue_date: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  channel_partner?: {
    id: string;
    name: string;
    country: string;
    email: string;
  };
  creator?: {
    full_name: string;
    email: string;
  };
  updater?: {
    full_name: string;
    email: string;
  };
};

interface ChannelPartner {
  id: string;
  name: string;
  country: string;
  email: string;
}

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

const isoStandardOptions = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2013',
  'ISO 22000:2018',
  'ISO 13485:2016',
  'ISO 50001:2018'
];

const statusOptions = [
  { value: 'application_form_sent', label: 'Application Form Sent' },
  { value: 'application_form_received', label: 'Application Form Received' },
  { value: 'draft_verified', label: 'Draft Verified' },
  { value: 'draft_approved', label: 'Draft Approved' },
  { value: 'certification_sent', label: 'Certification Sent' },
  { value: 'completed_won', label: 'Completed - Won' },
  { value: 'completed_lost', label: 'Completed - Lost' }
];

const tabs = [
  { id: 'information', label: 'Client Information', icon: '👤' },
  { id: 'documents', label: 'Document Management', icon: '📄' },
  { id: 'billing', label: 'Billing Management', icon: '💰' }
];

export default function ClientDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedClient, setEditedClient] = useState<Client | null>(null);
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<ChannelPartner[]>([]);
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('information');
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata[]>([]);

  useEffect(() => {
    if (params.id && user) {
      fetchClient(params.id as string);
      fetchChannelPartners();
      fetchFieldMetadata();
    }
  }, [params.id, user]);

  useEffect(() => {
    if (client) {
      setEditedClient({ ...client });
      if (client.channel_partner) {
        setPartnerSearchTerm(client.channel_partner.name);
      } else {
        setPartnerSearchTerm('');
      }
    }
  }, [client]);

  useEffect(() => {
    if (partnerSearchTerm) {
      const filtered = channelPartners.filter(partner =>
        partner.name.toLowerCase().includes(partnerSearchTerm.toLowerCase()) ||
        partner.country.toLowerCase().includes(partnerSearchTerm.toLowerCase())
      );
      setFilteredPartners(filtered);
    } else {
      setFilteredPartners(channelPartners);
    }
  }, [partnerSearchTerm, channelPartners]);

  const fetchChannelPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('channel_partners')
        .select('id, name, country, email')
        .order('name');

      if (error) {
        console.error('Error fetching channel partners:', error);
      } else {
        setChannelPartners(data || []);
        setFilteredPartners(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching channel partners:', err);
    }
  };

  const fetchFieldMetadata = async () => {
    try {
      console.log('🔍 Fetching field metadata for clients table');
      const { data, error } = await supabase
        .from('field_metadata')
        .select('*')
        .eq('table_name', 'clients')
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
      console.log('🔄 Syncing field metadata for clients table');
      const { data, error } = await supabase.rpc('sync_table_metadata', {
        table_name_param: 'clients'
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

  const fetchClient = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          channel_partner:referred_by(id, name, country, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Supabase error:', error);
        setError(error.message);
      } else {
        console.log('✅ Fetched client:', data);
        setClient({
          ...data,
          draft_url: data.draft_url || null,
          certificate_file_url: data.certificate_file_url || null,
          application_form_url: data.application_form_url || null,
          certificate_number: data.certificate_number || null,
          issue_date: data.issue_date || null,
          valid_until: data.valid_until || null,
        });
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerSelect = (partner: ChannelPartner) => {
    if (editedClient) {
      setEditedClient({ ...editedClient, referred_by: partner.id });
      setPartnerSearchTerm(partner.name);
      setShowPartnerDropdown(false);
    }
  };

  const handleSave = async () => {
    if (!editedClient || !client) return;
    
    setSaving(true);
    try {
      const updateData = {
        name: editedClient.name,
        email: editedClient.email,
        draft_uploaded: editedClient.draft_uploaded,
        certificate_sent: editedClient.certificate_sent,
        referred_by: editedClient.referred_by || null,
        certification_date: editedClient.certification_date || null,
        renewal_date: editedClient.renewal_date || null,
        iso_standard: editedClient.iso_standard || null,
        updated_at: new Date().toISOString(),
        Application_form_Date: editedClient.Application_form_Date || null,
        certificate_number: editedClient.certificate_number || null,
        issue_date: editedClient.issue_date || null,
        valid_until: editedClient.valid_until || null,
        certificate_file_url: editedClient.certificate_file_url || null,
      };

      const { data: updateResult, error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id)
        .select(`
          *,
          channel_partner:referred_by(id, name, country, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        alert('Error saving changes: ' + updateError.message);
        return;
      }

      const updatedClientData = Array.isArray(updateResult) ? updateResult[0] : updateResult;

      setClient(updatedClientData);
      setEditedClient(updatedClientData);
      setIsEditing(false);
    } catch (err) {
      console.error('❌ Unexpected save error:', err);
      alert('An unexpected error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (client) {
      setEditedClient({ ...client });
      if (client.channel_partner) {
        setPartnerSearchTerm(client.channel_partner.name);
      } else {
        setPartnerSearchTerm('');
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatSimpleDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US');
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {status || 'N/A'}
      </span>
    );
  };

  const handleFileDownload = (fileUrl: string | null, fileName: string) => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    } else {
      alert(`No ${fileName} file available to download.`);
    }
  };

  const handleDocumentUpload = async (documentType: 'draft' | 'certificate' | 'application_form', fileUrl: string) => {
    if (!client) return;
    setSaving(true);
    try {
      let updateData: Partial<Client> = {};
      if (documentType === 'draft') {
        updateData = { draft_url: fileUrl, draft_uploaded: true };
      } else if (documentType === 'certificate') {
        updateData = { certificate_file_url: fileUrl, certificate_sent: true };
      } else if (documentType === 'application_form') {
        updateData = { application_form_url: fileUrl };
      }

      const { data: updateResult, error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id)
        .select(`
          *,
          channel_partner:referred_by(id, name, country, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `)
        .single();

      if (updateError) {
        console.error('❌ Document URL update error:', updateError);
        alert('Error updating document URL: ' + updateError.message);
      } else {
        setClient(updateResult);
        setEditedClient(updateResult);
      }
    } catch (err) {
      console.error('❌ Unexpected document URL update error:', err);
      alert('An unexpected error occurred while updating document URL');
    } finally {
      setSaving(false);
    }
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
        if (field.api_name === 'referred_by' && client?.channel_partner) {
          return client.channel_partner.name;
        }
        return value;
      default:
        return value;
    }
  };

  // Add helper function to render field input
  const renderFieldInput = (field: FieldMetadata, value: any) => {
    const handleChange = (newValue: any) => {
      if (editedClient) {
        setEditedClient({ ...editedClient, [field.api_name]: newValue } as Client);
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
        if (field.api_name === 'referred_by') {
          return (
            <div className="relative">
              <input
                type="text"
                value={partnerSearchTerm}
                onChange={(e) => {
                  setPartnerSearchTerm(e.target.value);
                  setShowPartnerDropdown(true);
                }}
                onFocus={() => setShowPartnerDropdown(true)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Search channel partner"
              />
              {showPartnerDropdown && filteredPartners.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1">
                  {filteredPartners.map((partner) => (
                    <li
                      key={partner.id}
                      onClick={() => handlePartnerSelect(partner)}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                    >
                      {partner.name} ({partner.country})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
      case 'text':
      case 'varchar':
        if (field.api_name === 'status') {
          return (
            <select
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }
        if (field.api_name === 'iso_standard') {
          return (
            <select
              value={value || ''}
              onChange={(e) => handleChange(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Select ISO Standard</option>
              {isoStandardOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          );
        }
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
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

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg font-semibold">Loading client details...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <LoginForm />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
          <button 
            onClick={() => fetchClient(params.id as string)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  if (!client) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">Client not found.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen p-8 bg-gray-100">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            <div className="flex space-x-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Edit Client
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
              {/* User tracking info */}
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                {/* REMOVED: Created by, Created at, Last updated */}
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`
                  }
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div>
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
                                  {renderFieldValue(field, client[field.api_name as keyof Client])}
                                </p>
                              ) : (
                                renderFieldInput(field, editedClient?.[field.api_name as keyof Client])
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

            {activeTab === 'documents' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Document Actions</h2>
                <DocumentManager
                  clientId={client.id}
                  onDraftGenerated={(url) => handleDocumentUpload('draft', url)}
                  onCertificateGenerated={(url) => handleDocumentUpload('certificate', url)}
                  clientStatus={client.status}
                  applicationFormUrl={client.application_form_url}
                  draftUrl={client.draft_url}
                  certificateUrl={client.certificate_file_url}
                />
              </div>
            )}

            {activeTab === 'billing' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Billing Management</h2>
                <BillingManager clientId={client.id} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}