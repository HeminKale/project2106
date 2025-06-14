'use client';

import { useAuth } from '../../components/AuthProvider';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Layout from '../../components/Layout';
import LoginForm from '../../components/LoginForm';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

type BillingRecord = {
  id: string;
  client_id: string;
  amount: number;
  billing_date: string;
  due_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  client?: {
    id: string;
    name: string;
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

const statusOptions = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' }
];

export default function BillingDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedBilling, setEditedBilling] = useState<BillingRecord | null>(null);

  useEffect(() => {
    if (params.id && user) {
      fetchBilling(params.id as string);
    }
  }, [params.id, user]);

  useEffect(() => {
    if (billing) {
      setEditedBilling({ ...billing });
    }
  }, [billing]);

  const fetchBilling = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('billing')
        .select(`
          *,
          client:clients(id, name, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('❌ Supabase error:', error);
        setError(error.message);
      } else {
        console.log('✅ Fetched billing record:', data);
        setBilling(data);
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedBilling || !billing) return;
    
    setSaving(true);
    try {
      const updateData = {
        amount: editedBilling.amount,
        billing_date: editedBilling.billing_date,
        due_date: editedBilling.due_date,
        status: editedBilling.status,
        description: editedBilling.description,
        updated_at: new Date().toISOString()
      };

      const { data: updateResult, error: updateError } = await supabase
        .from('billing')
        .update(updateData)
        .eq('id', billing.id)
        .select(`
          *,
          client:clients(id, name, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        alert('Error saving changes: ' + updateError.message);
        return;
      }

      if (updateResult && updateResult.length > 0) {
        const updatedBilling = updateResult[0];
        setBilling(updatedBilling);
        setEditedBilling(updatedBilling);
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
    setEditedBilling(billing ? { ...billing } : null);
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

  const formatSimpleDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(option => option.value === status);
    if (!statusOption) return null;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusOption.color}`}>
        {statusOption.label}
      </span>
    );
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
          <span className="ml-3 text-gray-600">Loading billing record...</span>
        </div>
      </Layout>
    );
  }

  if (error || !billing || !editedBilling) {
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
                <h3 className="text-sm font-medium text-red-800">Billing record not found</h3>
                <p className="mt-1 text-sm text-red-700">{error || 'The requested billing record could not be found.'}</p>
                <Link 
                  href="/billing"
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Back to billing list
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/billing" 
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Billing
          </Link>
        </div>

        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Billing Record</h1>
                <p className="text-gray-600">{formatCurrency(billing.amount)}</p>
                {billing.client && (
                  <p className="text-sm text-blue-600">
                    Client: {billing.client.name} ({billing.client.email})
                  </p>
                )}
                <div className="mt-2">
                  {getStatusBadge(billing.status)}
                </div>
                {/* User tracking info */}
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  {billing.creator && (
                    <div>Created by: {billing.creator.full_name} ({billing.creator.email})</div>
                  )}
                  {billing.updater && (
                    <div>Last updated by: {billing.updater.full_name} ({billing.updater.email})</div>
                  )}
                </div>
              </div>
              
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
          </div>
        </div>

        {/* Billing Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Billing Information</h3>
          
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Basic Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Amount (USD)</label>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editedBilling.amount}
                      onChange={(e) => setEditedBilling({ ...editedBilling, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 py-2">{formatCurrency(billing.amount)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  {isEditing ? (
                    <select
                      value={editedBilling.status}
                      onChange={(e) => setEditedBilling({ ...editedBilling, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="py-2">
                      {getStatusBadge(billing.status)}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Billing Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedBilling.billing_date}
                      onChange={(e) => setEditedBilling({ ...editedBilling, billing_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 py-2">{formatSimpleDate(billing.billing_date)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Due Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedBilling.due_date || ''}
                      onChange={(e) => setEditedBilling({ ...editedBilling, due_date: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm text-gray-900 py-2">{formatSimpleDate(billing.due_date)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Client Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Client Name</label>
                  <p className="text-sm text-gray-900 py-2">{billing.client?.name || 'Unknown Client'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Client Email</label>
                  <p className="text-sm text-gray-900 py-2">{billing.client?.email || 'No email'}</p>
                </div>
              </div>
              {billing.client && (
                <div className="mt-2">
                  <Link
                    href={`/clients/${billing.client.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Client Details →
                  </Link>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Description</h4>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                {isEditing ? (
                  <textarea
                    value={editedBilling.description || ''}
                    onChange={(e) => setEditedBilling({ ...editedBilling, description: e.target.value || null })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter billing description..."
                  />
                ) : (
                  <p className="text-sm text-gray-900 py-2">{billing.description || 'No description provided'}</p>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">Timeline</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
                  <p className="text-sm text-gray-900 py-2">{formatDate(billing.created_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last Updated</label>
                  <p className="text-sm text-gray-900 py-2">{formatDate(billing.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}