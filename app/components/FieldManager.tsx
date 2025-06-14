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

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  table_name: string;
}

interface FieldManagerProps {
  objects: DatabaseObject[];
  selectedObject: string | null;
  columns: TableColumn[];
  onObjectSelect: (objectName: string) => void;
  onColumnsChange: () => void;
}

const dataTypes = [
  { value: 'text', label: 'Text' },
  { value: 'varchar(255)', label: 'Short Text (255 chars)' },
  { value: 'integer', label: 'Integer' },
  { value: 'decimal(10,2)', label: 'Decimal' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'timestamptz', label: 'Timestamp' },
  { value: 'uuid', label: 'UUID' },
  { value: 'jsonb', label: 'JSON' },
];

export default function FieldManager({ 
  objects, 
  selectedObject, 
  columns, 
  onObjectSelect, 
  onColumnsChange 
}: FieldManagerProps) {
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({
    name: '',
    type: 'text',
    nullable: true,
    defaultValue: '',
    showInCreate: true,
    required: false
  });
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddField = async () => {
    if (!selectedObject || !newField.name.trim()) {
      setMessage('❌ Field name is required');
      return;
    }

    // Validate field name
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newField.name)) {
      setMessage('❌ Field name must start with a letter and contain only letters, numbers, and underscores');
      return;
    }

    setAdding(true);
    setMessage('');

    try {
      let sql = `ALTER TABLE ${selectedObject} ADD COLUMN ${newField.name} ${newField.type}`;
      
      if (!newField.nullable) {
        sql += ' NOT NULL';
      }
      
      if (newField.defaultValue) {
        sql += ` DEFAULT '${newField.defaultValue}'`;
      }

      const { error } = await supabase.rpc('execute_sql', { sql });

      if (error) {
        setMessage(`❌ Error adding field: ${error.message}`);
      } else {
        setMessage('✅ Field added successfully!');
        setNewField({
          name: '',
          type: 'text',
          nullable: true,
          defaultValue: '',
          showInCreate: true,
          required: false
        });
        setShowAddField(false);
        onColumnsChange();
      }
    } catch (err) {
      setMessage('❌ An unexpected error occurred');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteField = async (fieldName: string) => {
    if (!selectedObject) return;

    // Prevent deletion of system fields
    const systemFields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    if (systemFields.includes(fieldName)) {
      alert('Cannot delete system fields');
      return;
    }

    if (!confirm(`Are you sure you want to delete the "${fieldName}" field? This will permanently remove all data in this column.`)) {
      return;
    }

    try {
      const { error } = await supabase.rpc('execute_sql', { 
        sql: `ALTER TABLE ${selectedObject} DROP COLUMN ${fieldName};` 
      });

      if (error) {
        alert(`Error deleting field: ${error.message}`);
      } else {
        alert('Field deleted successfully!');
        onColumnsChange();
      }
    } catch (err) {
      alert('An unexpected error occurred');
    }
  };

  const getFieldIcon = (dataType: string) => {
    const icons: { [key: string]: string } = {
      'text': '📝',
      'varchar': '📝',
      'integer': '🔢',
      'decimal': '💰',
      'boolean': '☑️',
      'date': '📅',
      'timestamptz': '⏰',
      'uuid': '🔑',
      'jsonb': '📋',
    };
    
    for (const [type, icon] of Object.entries(icons)) {
      if (dataType.includes(type)) {
        return icon;
      }
    }
    return '📄';
  };

  const isSystemField = (fieldName: string) => {
    return ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(fieldName);
  };

  const getFieldDescription = (column: TableColumn) => {
    const parts = [];
    
    if (column.is_nullable === 'NO') {
      parts.push('Required');
    } else {
      parts.push('Optional');
    }
    
    if (column.column_default) {
      parts.push(`Default: ${column.column_default}`);
    }
    
    if (column.character_maximum_length) {
      parts.push(`Max length: ${column.character_maximum_length}`);
    }
    
    return parts.join(' • ');
  };

  return (
    <div className="space-y-6">
      {/* Object Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Object to Manage Fields
        </label>
        <select
          value={selectedObject || ''}
          onChange={(e) => onObjectSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">Choose an object...</option>
          {objects.map((object) => (
            <option key={object.table_name} value={object.table_name}>
              {object.table_name}
            </option>
          ))}
        </select>
      </div>

      {selectedObject && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Fields for "{selectedObject}"
              </h3>
              <p className="text-sm text-gray-600">
                Manage columns and their properties
              </p>
            </div>
            <button
              onClick={() => setShowAddField(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Field
            </button>
          </div>

          {/* Add Field Form */}
          {showAddField && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Add New Field</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field Name *
                  </label>
                  <input
                    type="text"
                    value={newField.name}
                    onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                    placeholder="e.g., description, price, status"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Type *
                  </label>
                  <select
                    value={newField.type}
                    onChange={(e) => setNewField({ ...newField, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    {dataTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Value
                  </label>
                  <input
                    type="text"
                    value={newField.defaultValue}
                    onChange={(e) => setNewField({ ...newField, defaultValue: e.target.value })}
                    placeholder="Optional default value"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="nullable"
                      checked={newField.nullable}
                      onChange={(e) => setNewField({ ...newField, nullable: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="nullable" className="ml-2 text-sm text-gray-700">
                      Allow null values
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="showInCreate"
                      checked={newField.showInCreate}
                      onChange={(e) => setNewField({ ...newField, showInCreate: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="showInCreate" className="ml-2 text-sm text-gray-700">
                      Show in create form
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="required"
                      checked={newField.required}
                      onChange={(e) => setNewField({ ...newField, required: e.target.checked, nullable: !e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="required" className="ml-2 text-sm text-gray-700">
                      Required field
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddField}
                  disabled={adding}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Field'}
                </button>
                <button
                  onClick={() => {
                    setShowAddField(false);
                    setMessage('');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
              
              {message && (
                <div className={`mt-3 p-3 rounded-md text-sm ${
                  message.includes('✅') 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {message}
                </div>
              )}
            </div>
          )}

          {/* Fields List */}
          <div className="space-y-3">
            {columns.map((column) => (
              <div
                key={column.column_name}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">{getFieldIcon(column.data_type)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{column.column_name}</h4>
                        {isSystemField(column.column_name) && (
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                            System
                          </span>
                        )}
                        {column.is_nullable === 'NO' && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {column.data_type} • {getFieldDescription(column)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {column.data_type}
                    </span>
                    {!isSystemField(column.column_name) && (
                      <button
                        onClick={() => handleDeleteField(column.column_name)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete field"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {columns.length === 0 && (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No fields found</h3>
              <p className="mt-1 text-sm text-gray-500">Add fields to start building your object structure.</p>
            </div>
          )}
        </>
      )}

      {!selectedObject && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Select an object</h3>
          <p className="mt-1 text-sm text-gray-500">Choose an object from the dropdown above to manage its fields.</p>
        </div>
      )}
    </div>
  );
}