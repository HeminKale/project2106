'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface ChannelPartnerBillingManagerProps {
  channelPartnerId: string;
  channelPartnerName: string;
}

interface BillingRecord {
  id: string;
  client_id: string;
  amount: number;
  billing_date: string;
  due_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  client?: {
    name: string;
    email: string;
  };
}

const statusOptions = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' }
];

export default function ChannelPartnerBillingManager({ channelPartnerId, channelPartnerName }: ChannelPartnerBillingManagerProps) {
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [newBilling, setNewBilling] = useState({
    client_id: '',
    amount: '',
    billing_date: '',
    due_date: '',
    status: 'pending',
    description: ''
  });

  useEffect(() => {
    fetchBillingRecords();
    fetchClients();
  }, [channelPartnerId]);

  const fetchBillingRecords = async () => {
    try {
      setLoading(true);
      
      // Get billing records for clients referred by this channel partner
      const { data, error } = await supabase
        .from('billing')
        .select(`
          *,
          client:clients!inner(
            id,
            name,
            email,
            referred_by
          )
        `)
        .eq('client.referred_by', channelPartnerId)
        .order('billing_date', { ascending: false });

      if (error) {
        console.error('Error fetching billing records:', error);
      } else {
        setBillingRecords(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching billing records:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('referred_by', channelPartnerId)
        .order('name');

      if (error) {
        console.error('Error fetching clients:', error);
      } else {
        setClients(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching clients:', err);
    }
  };

  const handleAddBilling = async () => {
    if (!newBilling.client_id || !newBilling.amount || !newBilling.billing_date) {
      alert('Please fill in required fields (Client, Amount, and Billing Date)');
      return;
    }

    setSaving(true);
    try {
      const billingData = {
        client_id: newBilling.client_id,
        amount: parseFloat(newBilling.amount),
        billing_date: newBilling.billing_date,
        due_date: newBilling.due_date || null,
        status: newBilling.status,
        description: newBilling.description || null
      };

      const { data, error } = await supabase
        .from('billing')
        .insert(billingData)
        .select(`
          *,
          client:clients(name, email)
        `)
        .single();

      if (error) {
        console.error('Error creating billing record:', error);
        alert('Error creating billing record: ' + error.message);
      } else {
        setBillingRecords(prev => [data, ...prev]);
        setNewBilling({
          client_id: '',
          amount: '',
          billing_date: '',
          due_date: '',
          status: 'pending',
          description: ''
        });
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Unexpected error creating billing record:', err);
      alert('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (billingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('billing')
        .update({ status: newStatus })
        .eq('id', billingId);

      if (error) {
        console.error('Error updating billing status:', error);
        alert('Error updating status: ' + error.message);
      } else {
        setBillingRecords(prev =>
          prev.map(record =>
            record.id === billingId ? { ...record, status: newStatus } : record
          )
        );
      }
    } catch (err) {
      console.error('Unexpected error updating billing status:', err);
      alert('An unexpected error occurred');
    }
  };

  const formatDate = (dateString: string) => {
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

  const getTotalAmount = () => {
    return billingRecords
      .filter(record => record.status !== 'cancelled')
      .reduce((total, record) => total + record.amount, 0);
  };

  const getPaidAmount = () => {
    return billingRecords
      .filter(record => record.status === 'paid')
      .reduce((total, record) => total + record.amount, 0);
  };

  const getPendingAmount = () => {
    return billingRecords
      .filter(record => record.status === 'pending' || record.status === 'overdue')
      .reduce((total, record) => total + record.amount, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Billing for {channelPartnerName}</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-600">Total Billed</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(getTotalAmount())}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm font-medium text-green-600">Paid</div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(getPaidAmount())}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-sm font-medium text-yellow-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-900">{formatCurrency(getPendingAmount())}</div>
        </div>
      </div>

      {/* Add Billing Form */}
      {showAddForm && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-4">Add New Billing Record</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select
                value={newBilling.client_id}
                onChange={(e) => setNewBilling({ ...newBilling, client_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                value={newBilling.amount}
                onChange={(e) => setNewBilling({ ...newBilling, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Date *</label>
              <input
                type="date"
                value={newBilling.billing_date}
                onChange={(e) => setNewBilling({ ...newBilling, billing_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={newBilling.due_date}
                onChange={(e) => setNewBilling({ ...newBilling, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={newBilling.status}
                onChange={(e) => setNewBilling({ ...newBilling, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={newBilling.description}
                onChange={(e) => setNewBilling({ ...newBilling, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddBilling}
              disabled={saving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Billing'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Billing Records List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading billing records...</span>
        </div>
      ) : billingRecords.length === 0 ? (
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No billing records</h3>
          <p className="mt-1 text-sm text-gray-500">No billing records found for clients referred by this channel partner.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {billingRecords.map((record) => (
            <div key={record.id} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(record.amount)}
                    </span>
                    {getStatusBadge(record.status)}
                  </div>
                  <div className="text-sm text-gray-600">
                    <div><strong>Client:</strong> {record.client?.name || 'Unknown Client'}</div>
                    <div><strong>Billed:</strong> {formatDate(record.billing_date)}</div>
                    {record.due_date && (
                      <div><strong>Due:</strong> {formatDate(record.due_date)}</div>
                    )}
                    {record.description && (
                      <div className="mt-1 text-gray-500">{record.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={record.status}
                    onChange={(e) => handleStatusUpdate(record.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}