'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useForm } from 'react-hook-form';
import { useAuth } from './AuthProvider';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface FormData {
  name: string;
  country: string;
  phone: string;
  email: string;
  billing_rate: string;
}

interface ChannelPartnerFormProps {
  onPartnerCreated: (partner: any) => void;
  onCancel: () => void;
}

export default function ChannelPartnerForm({ onPartnerCreated, onCancel }: ChannelPartnerFormProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setMessage('');
    
    try {
      const partnerData = {
        name: data.name,
        country: data.country || null,
        phone: data.phone || null,
        email: data.email || null,
        billing_rate: data.billing_rate ? parseFloat(data.billing_rate) : null,
        created_by: user?.id || null,
        updated_by: user?.id || null
      };

      const { data: newPartner, error } = await supabase
        .from('channel_partners')
        .insert(partnerData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message.includes('channel_partners_email_key')) {
          setMessage(`❌ Error: A channel partner with the email address "${data.email}" already exists. Please use a different email address.`);
        } else {
          setMessage(`❌ Error: ${error.message}`);
        }
      } else {
        setMessage('✅ Channel partner created successfully!');
        reset();
        onPartnerCreated(newPartner);
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
              Partner Name *
            </label>
            <input 
              {...register('name', { required: 'Partner name is required' })} 
              placeholder="Enter partner name" 
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input 
              {...register('country')} 
              placeholder="Enter country" 
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input 
              {...register('phone')} 
              placeholder="Enter phone number" 
              type="tel"
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input 
              {...register('email', {
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Rate (USD)
            </label>
            <input 
              {...register('billing_rate', {
                pattern: {
                  value: /^\d+(\.\d{1,2})?$/,
                  message: 'Please enter a valid amount (e.g., 150.00)'
                }
              })} 
              placeholder="Enter billing rate (e.g., 150.00)" 
              type="number"
              step="0.01"
              className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {errors.billing_rate && <p className="text-red-500 text-sm mt-1">{errors.billing_rate.message}</p>}
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            type="submit" 
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Creating Partner...' : 'Create Partner'}
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