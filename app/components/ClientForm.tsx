'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

// ✅ Replace with your Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

interface FormData {
  name: string;
  email: string;
  channel_partner_id: string;
  referred_by: string;
  certification_date: string;
  renewal_date: string;
  iso_standard: string;
  status: string;
}

interface ChannelPartner {
  id: string;
  name: string;
  country: string;
  email: string;
}

const statusOptions = [
  { value: 'application_form_sent', label: 'Application Form Sent' },
  { value: 'application_form_received', label: 'Application Form Received' },
  { value: 'draft_verified', label: 'Draft Verified' },
  { value: 'draft_approved', label: 'Draft Approved' },
  { value: 'certification_sent', label: 'Certification Sent' },
  { value: 'completed_won', label: 'Completed - Won' },
  { value: 'completed_lost', label: 'Completed - Lost' }
];

const isoStandardOptions = [
  'ISO 9001:2015',
  'ISO 14001:2015',
  'ISO 45001:2018',
  'ISO 27001:2013',
  'ISO 22000:2018',
  'ISO 13485:2016',
  'ISO 50001:2018'
];

export default function ClientForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      status: 'application_form_sent' // Default to first stage
    }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<ChannelPartner[]>([]);
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);

  const watchedReferredBy = watch('referred_by');

  useEffect(() => {
    fetchChannelPartners();
  }, []);

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

  const handlePartnerSelect = (partner: ChannelPartner) => {
    setValue('referred_by', partner.id);
    setPartnerSearchTerm(partner.name);
    setShowPartnerDropdown(false);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setMessage('');
    
    try {
      const clientData = {
        name: data.name,
        email: data.email,
        draft_uploaded: false,
        certificate_sent: false,
        channel_partner_id: Number(data.channel_partner_id),
        referred_by: data.referred_by || null,
        certification_date: data.certification_date || null,
        renewal_date: data.renewal_date || null,
        iso_standard: data.iso_standard || null,
        status: data.status,
        created_by: user?.id || null,
        updated_by: user?.id || null
      };

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();

      if (error) {
        // Handle duplicate email error specifically
        if (error.code === '23505' && error.message.includes('clients_email_key')) {
          setMessage(`❌ Error: A client with the email address "${data.email}" already exists. Please use a different email address or check if this client is already in the system.`);
        } else {
          setMessage(`❌ Error: ${error.message}`);
        }
      } else {
        setMessage('✅ Client created successfully! Redirecting...');
        reset({
          name: '',
          email: '',
          channel_partner_id: '',
          referred_by: '',
          certification_date: '',
          renewal_date: '',
          iso_standard: '',
          status: 'application_form_sent'
        });
        setPartnerSearchTerm('');
        
        // Navigate to the newly created client
        setTimeout(() => {
          router.push(`/clients/${newClient.id}`);
        }, 1500);
      }
    } catch (err) {
      setMessage('❌ An unexpected error occurred');
    }
    
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 text-center">Create New Client</h2>
      
      {/* User Info */}
      {user?.user && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            Creating as: <strong>{user.user.full_name}</strong> ({user.user.email})
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Basic Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name *
              </label>
              <input 
                {...register('name', { required: 'Client name is required' })} 
                placeholder="Enter client name" 
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input 
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Please enter a valid email address'
                  }
                })} 
                placeholder="Enter email address" 
                type="email" 
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Channel Partner ID *
              </label>
              <input 
                {...register('channel_partner_id', { 
                  required: 'Channel Partner ID is required',
                  pattern: {
                    value: /^\d+$/,
                    message: 'Please enter a valid number'
                  }
                })} 
                placeholder="Enter channel partner ID" 
                type="number" 
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              {errors.channel_partner_id && <p className="text-red-500 text-sm mt-1">{errors.channel_partner_id.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Status *
              </label>
              <select 
                {...register('status', { required: 'Status is required' })}
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.status && <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>}
            </div>
          </div>
        </div>

        {/* Channel Partner Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Channel Partner</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referred By (Optional)
            </label>
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
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
              
              {showPartnerDropdown && partnerSearchTerm && filteredPartners.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-center text-gray-500">
                  No channel partners found
                </div>
              )}
            </div>
            <input type="hidden" {...register('referred_by')} />
          </div>
        </div>

        {/* Certification Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Certification Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ISO Standard
              </label>
              <select 
                {...register('iso_standard')}
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
              >
                <option value="">Select ISO Standard</option>
                {isoStandardOptions.map((standard) => (
                  <option key={standard} value={standard}>
                    {standard}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certification Date
              </label>
              <input 
                {...register('certification_date')} 
                type="date" 
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Renewal Date
              </label>
              <input 
                {...register('renewal_date')} 
                type="date" 
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Creating Client...' : 'Create Client'}
        </button>
      </form>

      {/* Click outside to close dropdown */}
      {showPartnerDropdown && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowPartnerDropdown(false)}
        />
      )}

      {message && (
        <div className={`mt-4 p-3 rounded-md text-sm ${
          message.includes('✅') 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}