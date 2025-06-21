'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { User } from '../lib/auth';
import { UserFormData } from '../types/user'; // Import UserFormData from shared types

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => Promise<void>;
  onDeleteUser?: (userId: string, hardDelete: boolean) => Promise<void>;
  editingUser: User | null;
  users: User[]; // Pass existing users for email validation
  creating: boolean; // Indicates if the form is currently submitting
  message: string; // Message from parent component (success/error)
}

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

export default function UserFormModal({
  isOpen,
  onClose,
  onSubmit: parentOnSubmit,
  onDeleteUser,
  editingUser,
  users,
  creating,
  message,
}: UserFormModalProps) {
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<UserFormData>();

  useEffect(() => {
    if (isOpen) {
      if (editingUser) {
        setValue('email', editingUser.email);
        setValue('full_name', editingUser.full_name);
        setValue('role', editingUser.role);
        setValue('department', editingUser.department || '');
      } else {
        reset();
      }
    }
  }, [isOpen, editingUser, setValue, reset]);

  const handleFormSubmit = async (data: UserFormData) => {
    await parentOnSubmit(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative transform transition-all duration-300 scale-100 opacity-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {editingUser ? 'Edit User' : 'Create New User'}
        </h2>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                {...register('full_name', { required: 'Full name is required' })}
                type="text"
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Please enter a valid email address'
                  },
                  validate: value => editingUser ? true : !users.some(u => u.email === value) || 'Email already exists'
                })}
                type="email"
                placeholder="john.doe@example.com"
                disabled={!!editingUser} // Disable email edit for existing users
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            {!editingUser && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  {...register('password', { required: !editingUser ? 'Password is required' : false })}
                  type="password"
                  placeholder="Enter password (default: password123)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                {...register('role', { required: 'Role is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department (Optional)</label>
              <select
                {...register('department')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select Department</option>
                {departmentOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {message && (
            <div className={`mt-4 p-3 rounded-md text-sm ${message.includes('❌') ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800 border border-green-200'}`}>
              {message}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            {editingUser && onDeleteUser && (
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => {
                    const dropdown = document.getElementById('user-actions-dropdown');
                    dropdown?.classList.toggle('hidden');
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Actions
                  <svg className="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div
                  id="user-actions-dropdown"
                  className="hidden origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                >
                  <div className="py-1" role="menu" aria-orientation="vertical">
                    {editingUser.is_active ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (editingUser) onDeleteUser(editingUser.id, false);
                          document.getElementById('user-actions-dropdown')?.classList.add('hidden');
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50"
                        role="menuitem"
                      >
                        Deactivate User
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        if (editingUser) onDeleteUser(editingUser.id, true);
                        document.getElementById('user-actions-dropdown')?.classList.add('hidden');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                      role="menuitem"
                    >
                      Delete User Permanently
                    </button>
                  </div>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {creating ? (editingUser ? 'Updating...' : 'Creating...') : (editingUser ? 'Save Changes' : 'Create User')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 