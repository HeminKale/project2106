'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface ChannelPartnerClientsListProps {
  channelPartnerId: string;
}

type Client = {
  id: string;
  name: string;
  email: string;
  status: string;
  iso_standard: string | null;
  certification_date: string | null;
  renewal_date: string | null;
  created_at: string;
};

const statusLabels: { [key: string]: string } = {
  'application_form_sent': 'Form Sent',
  'application_form_received': 'Form Received',
  'draft_verified': 'Draft Verified',
  'draft_approved': 'Draft Approved',
  'certification_sent': 'Cert Sent',
  'completed_won': 'Won',
  'completed_lost': 'Lost'
};

const statusColors: { [key: string]: string } = {
  'application_form_sent': 'bg-blue-100 text-blue-800',
  'application_form_received': 'bg-yellow-100 text-yellow-800',
  'draft_verified': 'bg-purple-100 text-purple-800',
  'draft_approved': 'bg-indigo-100 text-indigo-800',
  'certification_sent': 'bg-orange-100 text-orange-800',
  'completed_won': 'bg-green-100 text-green-800',
  'completed_lost': 'bg-red-100 text-red-800'
};

export default function ChannelPartnerClientsList({ channelPartnerId }: ChannelPartnerClientsListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (channelPartnerId) {
      fetchClients();
    }
  }, [channelPartnerId]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, status, iso_standard, certification_date, renewal_date, created_at')
        .eq('referred_by', channelPartnerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Supabase error fetching clients for channel partner:', error);
        setError(error.message);
      } else {
        const clientsWithStatus = (data || []).map(client => ({
          ...client,
          status: client.status || 'application_form_sent'
        }));
        setClients(clientsWithStatus);
      }
    } catch (err) {
      console.error('❌ Unexpected error fetching clients for channel partner:', err);
      setError('An unexpected error occurred while fetching clients.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatSimpleDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const label = statusLabels[status] || status;
    const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading clients...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">Clients ({filteredClients.length})</h3>
        <input
          type="text"
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No clients referred by this channel partner yet.
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ISO Standard
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Certification Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Renewal Date
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline">
                      <Link href={`/clients/${client.id}`}>
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.iso_standard || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(client.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatSimpleDate(client.certification_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatSimpleDate(client.renewal_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/clients/${client.id}`} className="text-indigo-600 hover:text-indigo-900">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 