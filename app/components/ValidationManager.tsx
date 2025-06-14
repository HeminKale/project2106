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

interface ValidationManagerProps {
  objects: DatabaseObject[];
  selectedObject: string | null;
  columns: TableColumn[];
  onObjectSelect: (objectName: string) => void;
}

interface ValidationRule {
  id: string;
  field: string;
  type: string;
  value: string;
  message: string;
  enabled: boolean;
}

const validationTypes = [
  { value: 'required', label: 'Required Field', description: 'Field must have a value' },
  { value: 'min_length', label: 'Minimum Length', description: 'Text must be at least X characters' },
  { value: 'max_length', label: 'Maximum Length', description: 'Text cannot exceed X characters' },
  { value: 'min_value', label: 'Minimum Value', description: 'Number must be at least X' },
  { value: 'max_value', label: 'Maximum Value', description: 'Number cannot exceed X' },
  { value: 'regex', label: 'Pattern Match', description: 'Text must match a regular expression' },
  { value: 'email', label: 'Email Format', description: 'Must be a valid email address' },
  { value: 'url', label: 'URL Format', description: 'Must be a valid URL' },
  { value: 'unique', label: 'Unique Value', description: 'Value must be unique in the table' },
  { value: 'custom', label: 'Custom Rule', description: 'Custom validation logic' },
];

export default function ValidationManager({ 
  objects, 
  selectedObject, 
  columns, 
  onObjectSelect 
}: ValidationManagerProps) {
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    field: '',
    type: 'required',
    value: '',
    message: '',
    enabled: true
  });
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddRule = async () => {
    if (!selectedObject || !newRule.field || !newRule.message.trim()) {
      setMessage('❌ Field and error message are required');
      return;
    }

    setAdding(true);
    setMessage('');

    try {
      const rule: ValidationRule = {
        id: Date.now().toString(),
        field: newRule.field,
        type: newRule.type,
        value: newRule.value,
        message: newRule.message,
        enabled: newRule.enabled
      };

      // In a real implementation, you would save this to a validation_rules table
      // For now, we'll just add it to local state
      setValidationRules(prev => [...prev, rule]);
      
      setMessage('✅ Validation rule added successfully!');
      setNewRule({
        field: '',
        type: 'required',
        value: '',
        message: '',
        enabled: true
      });
      setShowAddRule(false);
    } catch (err) {
      setMessage('❌ An unexpected error occurred');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this validation rule?')) {
      return;
    }
    
    setValidationRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const handleToggleRule = (ruleId: string) => {
    setValidationRules(prev => 
      prev.map(rule => 
        rule.id === ruleId 
          ? { ...rule, enabled: !rule.enabled }
          : rule
      )
    );
  };

  const getValidationIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      'required': '❗',
      'min_length': '📏',
      'max_length': '📐',
      'min_value': '🔢',
      'max_value': '🔢',
      'regex': '🔍',
      'email': '📧',
      'url': '🔗',
      'unique': '🔑',
      'custom': '⚙️',
    };
    return icons[type] || '✅';
  };

  const generateDefaultMessage = (type: string, field: string, value: string) => {
    const messages: { [key: string]: string } = {
      'required': `${field} is required`,
      'min_length': `${field} must be at least ${value} characters`,
      'max_length': `${field} cannot exceed ${value} characters`,
      'min_value': `${field} must be at least ${value}`,
      'max_value': `${field} cannot exceed ${value}`,
      'regex': `${field} format is invalid`,
      'email': `${field} must be a valid email address`,
      'url': `${field} must be a valid URL`,
      'unique': `${field} must be unique`,
      'custom': `${field} validation failed`,
    };
    return messages[type] || `${field} is invalid`;
  };

  const needsValue = (type: string) => {
    return ['min_length', 'max_length', 'min_value', 'max_value', 'regex', 'custom'].includes(type);
  };

  return (
    <div className="space-y-6">
      {/* Object Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Object to Manage Validation Rules
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
                Validation Rules for "{selectedObject}"
              </h3>
              <p className="text-sm text-gray-600">
                Define validation rules to ensure data quality
              </p>
            </div>
            <button
              onClick={() => setShowAddRule(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Rule
            </button>
          </div>

          {/* Add Rule Form */}
          {showAddRule && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-3">Add Validation Rule</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field *
                  </label>
                  <select
                    value={newRule.field}
                    onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select field...</option>
                    {columns.map((column) => (
                      <option key={column.column_name} value={column.column_name}>
                        {column.column_name} ({column.data_type})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validation Type *
                  </label>
                  <select
                    value={newRule.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      setNewRule({ 
                        ...newRule, 
                        type,
                        message: generateDefaultMessage(type, newRule.field, newRule.value)
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    {validationTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {validationTypes.find(t => t.value === newRule.type)?.description}
                  </p>
                </div>
                
                {needsValue(newRule.type) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value *
                    </label>
                    <input
                      type="text"
                      value={newRule.value}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewRule({ 
                          ...newRule, 
                          value,
                          message: generateDefaultMessage(newRule.type, newRule.field, value)
                        });
                      }}
                      placeholder={
                        newRule.type === 'regex' ? 'Regular expression pattern' :
                        newRule.type === 'custom' ? 'Custom validation logic' :
                        'Enter value'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
                
                <div className={needsValue(newRule.type) ? '' : 'md:col-span-2'}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Error Message *
                  </label>
                  <input
                    type="text"
                    value={newRule.message}
                    onChange={(e) => setNewRule({ ...newRule, message: e.target.value })}
                    placeholder="Error message to show when validation fails"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={newRule.enabled}
                      onChange={(e) => setNewRule({ ...newRule, enabled: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
                      Enable this validation rule
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleAddRule}
                  disabled={adding}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add Rule'}
                </button>
                <button
                  onClick={() => {
                    setShowAddRule(false);
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

          {/* Validation Rules List */}
          <div className="space-y-3">
            {validationRules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white border rounded-lg p-4 transition-all ${
                  rule.enabled 
                    ? 'border-gray-200 hover:shadow-sm' 
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">{getValidationIcon(rule.type)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">
                          {rule.field} - {validationTypes.find(t => t.value === rule.type)?.label}
                        </h4>
                        <span className={`text-xs px-2 py-1 rounded ${
                          rule.enabled 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">"{rule.message}"</p>
                      {rule.value && (
                        <p className="text-xs text-gray-500">Value: {rule.value}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`text-sm px-3 py-1 rounded transition-colors ${
                        rule.enabled
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete rule"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {validationRules.length === 0 && (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No validation rules</h3>
              <p className="mt-1 text-sm text-gray-500">Add validation rules to ensure data quality and consistency.</p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">💡 Validation Rules</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Validation rules help ensure data quality and consistency</p>
              <p>• Rules are checked when creating or updating records</p>
              <p>• Custom rules can implement complex business logic</p>
              <p>• Disabled rules are kept for reference but not enforced</p>
            </div>
          </div>
        </>
      )}

      {!selectedObject && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Select an object</h3>
          <p className="mt-1 text-sm text-gray-500">Choose an object from the dropdown above to manage its validation rules.</p>
        </div>
      )}
    </div>
  );
}