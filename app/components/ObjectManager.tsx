'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseObject {
  table_name: string;
  table_schema: string;
  table_type: string;
}

interface ObjectManagerProps {
  objects: DatabaseObject[];
  selectedObject: string | null;
  onObjectSelect: (objectName: string) => void;
  onObjectsChange: () => void;
}

export default function ObjectManager({ 
  objects, 
  selectedObject, 
  onObjectSelect, 
  onObjectsChange 
}: ObjectManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newObjectName, setNewObjectName] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateObject = async () => {
    if (!newObjectName.trim()) {
      setMessage('❌ Object name is required');
      return;
    }

    // Validate object name (only letters, numbers, underscores)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newObjectName)) {
      setMessage('❌ Object name must start with a letter and contain only letters, numbers, and underscores');
      return;
    }

    setCreating(true);
    setMessage('');

    try {
      // Create a basic table with id, created_at, updated_at, created_by, updated_by
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${newObjectName} (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          created_by uuid REFERENCES users(id),
          updated_by uuid REFERENCES users(id)
        );

        -- Enable RLS
        ALTER TABLE ${newObjectName} ENABLE ROW LEVEL SECURITY;

        -- Create basic policy
        CREATE POLICY "Users can manage ${newObjectName}"
          ON ${newObjectName}
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);

        -- Create updated_at trigger
        CREATE TRIGGER update_${newObjectName}_updated_at 
          BEFORE UPDATE ON ${newObjectName} 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();

        -- Create user tracking trigger
        CREATE TRIGGER ${newObjectName}_user_tracking
          BEFORE INSERT OR UPDATE ON ${newObjectName}
          FOR EACH ROW
          EXECUTE FUNCTION set_user_tracking();
      `;

      const { error } = await supabase.rpc('execute_sql', { sql: createTableSQL });

      if (error) {
        setMessage(`❌ Error creating object: ${error.message}`);
      } else {
        setMessage('✅ Object created successfully!');
        setNewObjectName('');
        setShowCreateForm(false);
        onObjectsChange();
      }
    } catch (err) {
      setMessage('❌ An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteObject = async (objectName: string) => {
    if (!confirm(`Are you sure you want to delete the "${objectName}" object? This action cannot be undone and will delete all data in this table.`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('execute_sql', { 
        sql: `DROP TABLE IF EXISTS ${objectName} CASCADE;` 
      });

      if (error) {
        alert(`Error deleting object: ${error.message}`);
      } else {
        alert('Object deleted successfully!');
        if (selectedObject === objectName) {
          onObjectSelect('');
        }
        onObjectsChange();
      }
    } catch (err) {
      alert('An unexpected error occurred');
    }
  };

  const getObjectIcon = (objectName: string) => {
    const icons: { [key: string]: string } = {
      'clients': '👥',
      'channel_partners': '🤝',
      'billing': '💰',
      'users': '👤',
    };
    return icons[objectName] || '📋';
  };

  const getObjectDescription = (objectName: string) => {
    const descriptions: { [key: string]: string } = {
      'clients': 'Customer and client information',
      'channel_partners': 'Partner and referral network data',
      'billing': 'Financial transactions and billing records',
      'users': 'System users and authentication',
    };
    return descriptions[objectName] || 'Custom database object';
  };

  const isSystemObject = (objectName: string) => {
    return ['clients', 'channel_partners', 'billing', 'users'].includes(objectName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Database Objects</h3>
          <p className="text-sm text-gray-600">Manage your database tables and objects</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Object
        </button>
      </div>

      {/* Create Object Form */}
      {showCreateForm && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Create New Object</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Object Name
              </label>
              <input
                type="text"
                value={newObjectName}
                onChange={(e) => setNewObjectName(e.target.value)}
                placeholder="e.g., products, orders, categories"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Must start with a letter and contain only letters, numbers, and underscores
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateObject}
                disabled={creating}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Object'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewObjectName('');
                  setMessage('');
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
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
        </div>
      )}

      {/* Objects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {objects.map((object) => (
          <div
            key={object.table_name}
            className={`
              border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md
              ${selectedObject === object.table_name 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'border-gray-200 bg-white hover:border-gray-300'
              }
            `}
            onClick={() => onObjectSelect(object.table_name)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getObjectIcon(object.table_name)}</div>
                <div>
                  <h4 className="font-medium text-gray-900">{object.table_name}</h4>
                  <p className="text-sm text-gray-500">{getObjectDescription(object.table_name)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {object.table_type === 'BASE TABLE' ? 'Table' : object.table_type}
                    </span>
                    {isSystemObject(object.table_name) && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                        System
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {!isSystemObject(object.table_name) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteObject(object.table_name);
                  }}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Delete object"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {objects.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No objects found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating your first database object.</p>
        </div>
      )}

      {/* Selected Object Info */}
      {selectedObject && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            Selected Object: {selectedObject}
          </h4>
          <p className="text-sm text-blue-700">
            Use the Fields tab to manage columns and properties for this object.
          </p>
        </div>
      )}
    </div>
  );
}