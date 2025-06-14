'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useForm } from 'react-hook-form';
import { useAuth } from './AuthProvider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface FormData {
  client_id: string;
  channel_partner_id: string;
  amount: string;
  billing_date: string;
  due_date: string;
  status: string;
  description: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  referred_by: string | null;
  channel_partner?: {
    id: string;
    name: string;
  }[];
}

interface ChannelPartner {
  id: string;
  name: string;
  country: string;
}

interface BillingFormProps {
  onBillingCreated: (billing: any) => void;
  onCancel: () => void;
}

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' }
];

export default function BillingForm({ onBillingCreated, onCancel }: BillingFormProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      status: 'pending'
    }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const { user } = useAuth();

  const watchedClientId = watch('client_id');

  useEffect(() => {
    fetchClients();
    fetchChannelPartners();
  }, []);

  // Auto-select channel partner when client is selected
  useEffect(() => {
    if (watchedClientId) {
      const selectedClient = clients.find(client => client.id === watchedClientId);
      if (selectedClient?.referred_by) {
        setValue('channel_partner_id', selectedClient.referred_by);
      }
    }
  }, [watchedClientId, clients, setValue]);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id, 
          name, 
          email, 
          referred_by,
          channel_partner:referred_by(id, name)
        `)
        .order('name');

      if (error) {
        console.error('Error fetching clients:', error);
      } else {
        setClients(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchChannelPartners = async () => {
    try {
      setLoadingPartners(true);
      const { data, error } = await supabase
        .from('channel_partners')
        .select('id, name, country')
        .order('name');

      if (error) {
        console.error('Error fetching channel partners:', error);
      } else {
        setChannelPartners(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching channel partners:', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setMessage('');
    
    try {
      const billingData = {
        client_id: data.client_id,
        channel_partner_id: data.channel_partner_id || null,
        amount: parseFloat(data.amount),
        billing_date: data.billing_date,
        due_date: data.due_date || null,
        status: data.status,
        description: data.description || null,
        created_by: user?.id || null,
        updated_by: user?.id || null
      };

      const { data: newBilling, error } = await supabase
        .from('billing')
        .insert(billingData)
        .select(`
          *,
          client:clients(name, email),
          channel_partner:channel_partners(name, country)
        `)
        .single();

      if (error) {
        setMessage(`❌ Error: ${error.message}`);
      } else {
        setMessage('✅ Billing record created successfully!');
        reset({
          client_id: '',
          channel_partner_id: '',
          amount: '',
          billing_date: '',
          due_date: '',
          status: 'pending',
          description: ''
        });
        onBillingCreated(newBilling);
      }
    } catch (err) {
      setMessage('❌ An unexpected error occurred');
    }
    
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client *
            </label>
            {loadingClients ? (
              <div className="w-full border border-gray-300 rounded-md p-3 bg-gray-50 text-gray-500">
                Loading clients...
              </div>
            ) : (
              <select
                {...register('client_id', { required: 'Client is required' })}
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.email})
                    {client.channel_partner && client.channel_partner.length > 0 && ` - via ${client.channel_partner[0]?.name}`}
                  </option>
                ))}
              </select>
            )}
            {errors.client_id && <p className="text-red-500 text-sm mt-1">{errors.client_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Channel Partner
            </label>
            {loadingPartners ? (
              <div className="w-full border border-gray-300 rounded-md p-3 bg-gray-50 text-gray-500">
                Loading channel partners...
              </div>
            ) : (
              <select
                {...register('channel_partner_id')}
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select channel partner (optional)</option>
                {channelPartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name} ({partner.country})
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Auto-selected based on client's referral partner
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (USD) *
            </label>
            <input 
              {...register('amount', { 
                required: 'Amount is required',
                pattern: {
                  value: /^\d+(\.\d{1,2})?$/,
                  message: 'Please enter a valid amount (e.g., 150.00)'
                }
              })} 
              placeholder="Enter amount (e.g., 2500.00)" 
              type="number"
              step="0.01"
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Date *
            </label>
            <input 
              {...register('billing_date', { required: 'Billing date is required' })} 
              type="date" 
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {errors.billing_date && <p className="text-red-500 text-sm mt-1">{errors.billing_date.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input 
              {...register('due_date')} 
              type="date" 
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea 
              {...register('description')} 
              placeholder="Enter billing description (optional)"
              rows={3}
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            type="submit" 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || loadingClients || loadingPartners}
          >
            {loading ? 'Creating Billing Record...' : 'Create Billing Record'}
          </button>
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-md transition-colors duration-200"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>

      {message && (
        <div className={`p-3 rounded-md text-sm ${
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