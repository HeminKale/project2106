'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { getUsers, createUser, updateUser, deleteUser, User } from '../lib/auth';
import { useAuth } from './AuthProvider';
import UserFormModal from './UserFormModal';
import { UserFormData } from '../types/user';

const roleOptions = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'viewer', label: 'Viewer' }
];

const departmentOptions = [
  'IT',
  'Operations',
  'Client Services',
  'Reporting',
  'Finance',
  'HR'
];

export default function UserManagement() {
  const { user: currentUser, setImpersonatedUserName } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<UserFormData>();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!editingUser) {
      reset();
    }
  }, [editingUser, reset]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching users...');
      
      const { data, error } = await getUsers();
      
      if (error) {
        console.error('Error fetching users:', error);
        setError(error.message);
      } else {
        console.log('Fetched users:', data);
        setUsers(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred while fetching users');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: UserFormData) => {
    setCreating(true);
    setMessage('');

    try {
      if (editingUser) {
        // Update existing user
        const { error } = await updateUser(editingUser.id, {
          full_name: data.full_name,
          role: data.role as any,
          department: data.department || null,
        });

        if (error) {
          setMessage(`❌ Error updating user: ${error.message}`);
        } else {
          setMessage('✅ User updated successfully!');
          setEditingUser(null);
          setShowCreateForm(false);
          fetchUsers();
        }
      } else {
        // Create new user
        const { error } = await createUser({
          email: data.email,
          password: data.password as string,
          full_name: data.full_name,
          role: data.role,
          department: data.department || undefined,
        });

        if (error) {
          setMessage(`❌ Error creating user: ${error.message}`);
        } else {
          setMessage('✅ User created successfully!');
          setShowCreateForm(false);
          reset();
          fetchUsers();
        }
      }
    } catch (err) {
      setMessage('❌ An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, hardDelete: boolean = false) => {
    const action = hardDelete ? 'permanently delete' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} this user? This action cannot be undone.`)) return;

    try {
      const { error } = await deleteUser(userId, hardDelete);
      
      if (error) {
        setMessage(`❌ Error ${action}ing user: ${error.message}`);
      } else {
        setMessage(`✅ User ${action}ed successfully!`);
        setShowCreateForm(false);
        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      setMessage(`❌ An unexpected error occurred during ${action}`);
    }
  };

  const handleLoginAs = async (userId: string) => {
    try {
      const response = await fetch('/api/auth/login-as', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(`✅ Successfully logged in as user: ${userId}`);
        // Set the impersonated user's name in AuthProvider context
        const impersonatedUser = users.find(u => u.id === userId);
        if (impersonatedUser) {
          setImpersonatedUserName(impersonatedUser.full_name);
        }
        // Redirect to a dashboard or home page, or refresh the current page
        window.location.href = '/'; // Redirects to home, which will re-auth
      } else {
        setMessage(`❌ Error logging in as user: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setMessage('❌ An unexpected error occurred during login as');
      console.error(err);
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.department || '').toLowerCase().includes(searchTerm.toLowerCase())
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

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      employee: 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[role as keyof typeof colors] || colors.viewer}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  // Check if current user can manage users
  const canManageUsers = currentUser?.user?.role === 'admin' || currentUser?.user?.role === 'manager';

  if (!canManageUsers) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to manage users.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading users</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button 
              onClick={fetchUsers}
              className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-600">
            {filteredUsers.length} total user{filteredUsers.length !== 1 ? 's' : ''}
            {searchTerm && ` (filtered from ${users.length})`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {currentUser?.user?.role === 'admin' && (
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingUser(null);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New User
            </button>
          )}
        </div>
      </div>

      {/* User Form Modal */}
      <UserFormModal
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false);
          setEditingUser(null);
          setMessage('');
        }}
        onSubmit={onSubmit}
        onDeleteUser={handleDeleteUser}
        editingUser={editingUser}
        users={users}
        creating={creating}
        message={message}
      />

      {/* Users Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors duration-150 ${!user.is_active ? 'bg-gray-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.full_name}
                      {!user.is_active && (
                        <span className="ml-2 text-xs text-gray-500">(Deactivated)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.department || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.updated_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {currentUser?.user?.role === 'admin' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowCreateForm(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleLoginAs(user.id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Login
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}