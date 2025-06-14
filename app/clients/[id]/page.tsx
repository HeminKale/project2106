'use client';

import { useAuth } from '../../components/AuthProvider';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Layout from '../../components/Layout';
import StatusTimeline from '../../components/StatusTimeline';
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
  channel_partner_id: number;
  draft_uploaded: boolean;
  certificate_sent: boolean;
  status: string;
  referred_by: string | null;
  certification_date: string | null;
  renewal_date: string | null;
  iso_standard: string | null;
  draft_file_url: string | null;
  certificate_file_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  channel_partner?: {
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

const isoStandardOptions = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2013',
  'ISO 22000:2018',
  'ISO 13485:2016',
  'ISO 50001:2018'
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

  useEffect(() => {
    if (params.id && user) {
      fetchClient(params.id as string);
      fetchChannelPartners();
    }
  }, [params.id, user]);

  useEffect(() => {
    if (client) {
      setEditedClient({ ...client });
      if (client.channel_partner) {
        setPartnerSearchTerm(client.channel_partner.name);
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

  const fetchClient = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          channel_partner:referred_by(name, country, email),
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
          status: data.status || 'application_form_sent'
        });
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!client) return;
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id)
        .select(`
          *,
          channel_partner:referred_by(name, country, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `)
        .single();

      if (error) {
        console.error('❌ Status update error:', error);
        alert('Error updating status: ' + error.message);
      } else {
        setClient(data);
        setEditedClient(data);
      }
    } catch (err) {
      console.error('❌ Unexpected status update error:', err);
      alert('An unexpected error occurred while updating status');
    } finally {
      setSaving(false);
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
        channel_partner_id: editedClient.channel_partner_id,
        draft_uploaded: editedClient.draft_uploaded,
        certificate_sent: editedClient.certificate_sent,
        referred_by: editedClient.referred_by || null,
        certification_date: editedClient.certification_date || null,
        renewal_date: editedClient.renewal_date || null,
        iso_standard: editedClient.iso_standard || null,
        updated_at: new Date().toISOString()
      };

      const { data: updateResult, error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id)
        .select(`
          *,
          channel_partner:referred_by(name, country, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        alert('Error saving changes: ' + updateError.message);
        return;
      }

      if (updateResult && updateResult.length > 0) {
        const updatedClient = updateResult[0];
        setClient(updatedClient);
        setEditedClient(updatedClient);
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
    setEditedClient(client ? { ...client } : null);
    setIsEditing(false);
    if (client?.channel_partner) {
      setPartnerSearchTerm(client.channel_partner.name);
    } else {
      setPartnerSearchTerm('');
    }
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

  const formatSimpleDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleFileDownload = (fileUrl: string | null, fileName: string) => {
    if (!fileUrl) {
      alert('No file available for download');
      return;
    }
    
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDocumentUpload = async (documentType: 'draft' | 'certificate', fileUrl: string) => {
    if (!client) return;

    try {
      const updateField = documentType === 'draft' ? 'draft_file_url' : 'certificate_file_url';
      const legacyField = documentType === 'draft' ? 'draft_uploaded' : 'certificate_sent';
      
      const { data, error } = await supabase
        .from('clients')
        .update({ 
          [updateField]: fileUrl,
          [legacyField]: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id)
        .select(`
          *,
          channel_partner:referred_by(name, country, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `)
        .single();

      if (error) {
        console.error('❌ Error updating client with file URL:', error);
        alert('Error updating client record: ' + error.message);
      } else {
        setClient(data);
        setEditedClient(data);
      }
    } catch (err) {
      console.error('❌ Unexpected error updating client:', err);
      alert('An unexpected error occurred while updating client record');
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
          <span className="ml-3 text-gray-600">Loading client details...</span>
        </div>
      </Layout>
    );
  }

  if (error || !client || !editedClient) {
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
                <h3 className="text-sm font-medium text-red-800">Client not found</h3>
                <p className="mt-1 text-sm text-red-700">{error || 'The requested client could not be found.'}</p>
                <Link 
                  href="/clients"
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Back to clients list
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
            href="/clients" 
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Clients
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
                <p className="text-gray-600">{client.email}</p>
                {client.channel_partner && (
                  <p className="text-sm text-blue-600">
                    Referred by: {client.channel_partner.name} ({client.channel_partner.country})
                  </p>
                )}
                {/* User tracking info */}
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  {client.creator && (
                    <div>Created by: {client.creator.full_name} ({client.creator.email})</div>
                  )}
                  {client.updater && (
                    <div>Last updated by: {client.updater.full_name} ({client.updater.email})</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact Status Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <StatusTimeline 
            currentStatus={client.status || 'application_form_sent'}
            onStatusChange={handleStatusChange}
            isEditing={user.user?.role !== 'viewer'}
          />
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
            {/* Client Information Tab */}
            {activeTab === 'information' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Client Information</h3>
                  
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
                        <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedClient.name}
                            onChange={(e) => setEditedClient({ ...editedClient, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{client.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                        {isEditing ? (
                          <input
                            type="email"
                            value={editedClient.email}
                            onChange={(e) => setEditedClient({ ...editedClient, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{client.email}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Channel Partner ID</label>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editedClient.channel_partner_id}
                            onChange={(e) => setEditedClient({ ...editedClient, channel_partner_id: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">#{client.channel_partner_id}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Current Status</label>
                        <p className="text-sm text-gray-900 py-2 capitalize">{client.status.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Channel Partner Information */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Channel Partner</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Referred By</label>
                      {isEditing ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={partnerSearchTerm}
                            onChange={(e) => {
                              setPartnerSearchTerm(e.target.value);
                              setShowPartnerDropdown(true);
                            }}
                            onFocus={() => setShowPartnerDropdown(true)}
                            placeholder="Search channel partners..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          
                          {showPartnerDropdown && filteredPartners.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {filteredPartners.map((partner) => (
                                <div
                                  key={partner.id}
                                  onClick={() => handlePartnerSelect(partner)}
                                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">{partner.name}</div>
                                  <div className="text-sm text-gray-500">{partner.country} • {partner.email}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-900 py-2">
                          {client.channel_partner 
                            ? `${client.channel_partner.name} (${client.channel_partner.country})`
                            : 'Not assigned'
                          }
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Certification Information */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Certification Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">ISO Standard</label>
                        {isEditing ? (
                          <select
                            value={editedClient.iso_standard || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, iso_standard: e.target.value || null })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          >
                            <option value="">Select ISO Standard</option>
                            {isoStandardOptions.map((standard) => (
                              <option key={standard} value={standard}>
                                {standard}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{client.iso_standard || 'Not specified'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Certification Date</label>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editedClient.certification_date || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, certification_date: e.target.value || null })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{formatSimpleDate(client.certification_date)}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Renewal Date</label>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editedClient.renewal_date || ''}
                            onChange={(e) => setEditedClient({ ...editedClient, renewal_date: e.target.value || null })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 py-2">{formatSimpleDate(client.renewal_date)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Document Files */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Document Files</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Draft Document</label>
                        <div className="flex items-center gap-2">
                          {client.draft_file_url ? (
                            <button
                              onClick={() => handleFileDownload(client.draft_file_url, `${client.name}_draft.pdf`)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download Draft
                            </button>
                          ) : (
                            <span className="text-sm text-gray-500">No draft file</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Certificate Document</label>
                        <div className="flex items-center gap-2">
                          {client.certificate_file_url ? (
                            <button
                              onClick={() => handleFileDownload(client.certificate_file_url, `${client.name}_certificate.pdf`)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Download Certificate
                            </button>
                          ) : (
                            <span className="text-sm text-gray-500">No certificate file</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legacy Status Information */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900">Legacy Status</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Draft Status</label>
                        {isEditing ? (
                          <select
                            value={editedClient.draft_uploaded ? 'true' : 'false'}
                            onChange={(e) => setEditedClient({ ...editedClient, draft_uploaded: e.target.value === 'true' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="false">No Draft</option>
                            <option value="true">Draft Uploaded</option>
                          </select>
                        ) : (
                          <div className="py-2">
                            <span className={`
                              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${client.draft_uploaded 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                              }
                            `}>
                              {client.draft_uploaded ? '✅ Draft Uploaded' : '⏳ No Draft'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Certificate Status</label>
                        {isEditing ? (
                          <select
                            value={editedClient.certificate_sent ? 'true' : 'false'}
                            onChange={(e) => setEditedClient({ ...editedClient, certificate_sent: e.target.value === 'true' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="false">Pending</option>
                            <option value="true">Certificate Sent</option>
                          </select>
                        ) : (
                          <div className="py-2">
                            <span className={`
                              inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${client.certificate_sent 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                              }
                            `}>
                              {client.certificate_sent ? '✅ Certificate Sent' : '⏳ Pending'}
                            </span>
                          </div>
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
                        <p className="text-sm text-gray-900 py-2">{formatDate(client.created_at)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Last Updated</label>
                        <p className="text-sm text-gray-900 py-2">{formatDate(client.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Document Management Tab */}
            {activeTab === 'documents' && (
              <DocumentManager 
                clientId={client.id} 
                clientName={client.name}
                onDocumentUpload={handleDocumentUpload}
              />
            )}

            {/* Billing Management Tab */}
            {activeTab === 'billing' && (
              <BillingManager 
                clientId={client.id} 
                clientName={client.name}
              />
            )}
          </div>
        </div>

        {/* Click outside to close dropdown */}
        {showPartnerDropdown && (
          <div 
            className="fixed inset-0 z-5" 
            onClick={() => setShowPartnerDropdown(false)}
          />
        )}
      </div>
    </Layout>
  );
}