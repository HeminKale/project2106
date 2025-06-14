'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthProvider';
import UserCreator from './UserCreator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface DatabaseObject {
  table_name: string;
  table_schema: string;
  table_type: string;
}

interface FieldMetadata {
  id: string;
  table_name: string;
  api_name: string;
  display_label: string;
  field_type: string;
  is_required: boolean;
  is_nullable: boolean;
  default_value: string | null;
  validation_rules: any[];
  display_order: number;
  section: 'basic' | 'details' | 'system';
  width: 'half' | 'full';
  is_visible: boolean;
  is_system_field: boolean;
  reference_table: string | null;
  reference_display_field: string | null;
}

const settingsTabs = [
  { id: 'objects', label: 'Objects & Fields', icon: '🗂️', description: 'Manage database objects, fields, and layouts' },
  { id: 'users', label: 'User Management', icon: '👤', description: 'Create and manage system users' },
  { id: 'validation', label: 'Validation Rules', icon: '✅', description: 'Set up validation rules' },
];

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
  { value: 'reference', label: 'Reference (Foreign Key)' },
];

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

export default function SettingsManager() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('objects');
  const [objects, setObjects] = useState<DatabaseObject[]>([]);
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'fields' | 'layout' | 'validation'>('fields');
  
  // Object creation
  const [showCreateObject, setShowCreateObject] = useState(false);
  const [newObjectName, setNewObjectName] = useState('');
  const [creatingObject, setCreatingObject] = useState(false);
  
  // Field creation
  const [showCreateField, setShowCreateField] = useState(false);
  const [newField, setNewField] = useState({
    api_name: '',
    display_label: '',
    field_type: 'text',
    is_required: false,
    default_value: '',
    section: 'details' as 'basic' | 'details' | 'system',
    width: 'half' as 'half' | 'full',
    reference_table: '',
    reference_display_field: ''
  });
  const [creatingField, setCreatingField] = useState(false);
  
  // Validation rules
  const [validationRules, setValidationRules] = useState<any[]>([]);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRule, setNewRule] = useState({
    field: '',
    type: 'required',
    value: '',
    message: '',
    enabled: true
  });
  
  const [message, setMessage] = useState('');

  // Check if user has admin access
  const hasAdminAccess = user?.user?.role === 'admin';

  useEffect(() => {
    if (hasAdminAccess) {
      fetchDatabaseObjects();
    }
  }, [hasAdminAccess]);

  useEffect(() => {
    if (selectedObject) {
      fetchFieldMetadata(selectedObject);
    }
  }, [selectedObject]);

  const fetchDatabaseObjects = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_database_objects');
      
      if (error) {
        console.error('Error fetching database objects:', error);
        setObjects([
          { table_name: 'clients', table_schema: 'public', table_type: 'BASE TABLE' },
          { table_name: 'channel_partners', table_schema: 'public', table_type: 'BASE TABLE' },
          { table_name: 'billing', table_schema: 'public', table_type: 'BASE TABLE' },
          { table_name: 'users', table_schema: 'public', table_type: 'BASE TABLE' },
        ]);
      } else {
        setObjects(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setObjects([
        { table_name: 'clients', table_schema: 'public', table_type: 'BASE TABLE' },
        { table_name: 'channel_partners', table_schema: 'public', table_type: 'BASE TABLE' },
        { table_name: 'billing', table_schema: 'public', table_type: 'BASE TABLE' },
        { table_name: 'users', table_schema: 'public', table_type: 'BASE TABLE' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldMetadata = async (tableName: string) => {
    try {
      console.log('🔍 Fetching field metadata for table:', tableName);
      
      const { data, error } = await supabase.rpc('get_field_metadata', { 
        table_name_param: tableName 
      });
      
      if (error) {
        console.error('❌ Error fetching field metadata:', error);
        // Fallback to sync metadata if not found
        await syncTableMetadata(tableName);
      } else {
        console.log('✅ Fetched field metadata:', data);
        setFieldMetadata(data || []);
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setFieldMetadata([]);
    }
  };

  const syncTableMetadata = async (tableName: string) => {
    try {
      const { data, error } = await supabase.rpc('sync_table_metadata', { 
        table_name_param: tableName 
      });
      
      if (error) {
        console.error('❌ Error syncing metadata:', error);
      } else {
        console.log('✅ Metadata synced:', data);
        // Fetch the metadata again after syncing
        fetchFieldMetadata(tableName);
      }
    } catch (err) {
      console.error('❌ Unexpected error syncing metadata:', err);
    }
  };

  const handleCreateObject = async () => {
    if (!newObjectName.trim()) {
      setMessage('❌ Object name is required');
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newObjectName)) {
      setMessage('❌ Object name must start with a letter and contain only letters, numbers, and underscores');
      return;
    }

    setCreatingObject(true);
    setMessage('');

    try {
      console.log('🔧 Creating object:', newObjectName);
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${newObjectName} (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          created_by uuid REFERENCES users(id),
          updated_by uuid REFERENCES users(id)
        );

        ALTER TABLE ${newObjectName} ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can manage ${newObjectName}"
          ON ${newObjectName}
          FOR ALL
          TO authenticated, anon, public
          USING (true)
          WITH CHECK (true);

        CREATE TRIGGER update_${newObjectName}_updated_at 
          BEFORE UPDATE ON ${newObjectName} 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();

        CREATE TRIGGER ${newObjectName}_user_tracking
          BEFORE INSERT OR UPDATE ON ${newObjectName}
          FOR EACH ROW
          EXECUTE FUNCTION set_user_tracking();
      `;

      const { data, error } = await supabase.rpc('execute_sql', { sql: createTableSQL });

      if (error) {
        console.error('❌ Error creating object:', error);
        setMessage(`❌ Error creating object: ${error.message}`);
      } else {
        console.log('✅ Object created successfully:', data);
        
        // Sync metadata for the new table
        await syncTableMetadata(newObjectName);
        
        setMessage('✅ Object created successfully!');
        setNewObjectName('');
        setShowCreateObject(false);
        fetchDatabaseObjects();
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setMessage('❌ An unexpected error occurred');
    } finally {
      setCreatingObject(false);
    }
  };

  const handleCreateField = async () => {
    if (!selectedObject || !newField.api_name.trim() || !newField.display_label.trim()) {
      setMessage('❌ API name and display label are required');
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newField.api_name)) {
      setMessage('❌ API name must start with a letter and contain only letters, numbers, and underscores');
      return;
    }

    // Validate reference field requirements
    if (newField.field_type === 'reference') {
      if (!newField.reference_table) {
        setMessage('❌ Reference table is required for reference fields');
        return;
      }
      if (!newField.reference_display_field) {
        setMessage('❌ Display field is required for reference fields');
        return;
      }
    }

    setCreatingField(true);
    setMessage('');

    try {
      console.log('🔧 Creating field:', newField.api_name, 'on table:', selectedObject);
      
      if (newField.field_type === 'reference') {
        // Create reference field with foreign key
        const { data, error } = await supabase.rpc('create_reference_field_with_metadata', {
          table_name_param: selectedObject,
          api_name_param: newField.api_name,
          display_label_param: newField.display_label,
          is_required_param: newField.is_required,
          default_value_param: newField.default_value || null,
          section_param: newField.section,
          width_param: newField.width,
          reference_table_param: newField.reference_table,
          reference_display_field_param: newField.reference_display_field
        });

        if (error) {
          console.error('❌ Error adding reference field:', error);
          setMessage(`❌ Error adding reference field: ${error.message}`);
        } else {
          console.log('✅ Reference field added successfully:', data);
          setMessage('✅ Reference field added successfully!');
          resetNewField();
          fetchFieldMetadata(selectedObject);
        }
      } else {
        // Create regular field
        const { data, error } = await supabase.rpc('create_field_with_metadata', {
          table_name_param: selectedObject,
          api_name_param: newField.api_name,
          display_label_param: newField.display_label,
          field_type_param: newField.field_type,
          is_required_param: newField.is_required,
          default_value_param: newField.default_value || null,
          section_param: newField.section,
          width_param: newField.width
        });

        if (error) {
          console.error('❌ Error adding field:', error);
          setMessage(`❌ Error adding field: ${error.message}`);
        } else {
          console.log('✅ Field added successfully:', data);
          setMessage('✅ Field added successfully!');
          resetNewField();
          fetchFieldMetadata(selectedObject);
        }
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setMessage('❌ An unexpected error occurred');
    } finally {
      setCreatingField(false);
    }
  };

  const resetNewField = () => {
    setNewField({
      api_name: '',
      display_label: '',
      field_type: 'text',
      is_required: false,
      default_value: '',
      section: 'details',
      width: 'half',
      reference_table: '',
      reference_display_field: ''
    });
    setShowCreateField(false);
  };

  const handleDeleteField = async (fieldId: string, apiName: string) => {
    if (!selectedObject) return;

    const systemFields = ['id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    if (systemFields.includes(apiName)) {
      alert('Cannot delete system fields');
      return;
    }

    if (!confirm(`Are you sure you want to delete the "${apiName}" field?`)) {
      return;
    }

    try {
      // Delete the column from the table
      const { error: sqlError } = await supabase.rpc('execute_sql', { 
        sql: `ALTER TABLE ${selectedObject} DROP COLUMN ${apiName};` 
      });

      if (sqlError) {
        alert(`Error deleting field: ${sqlError.message}`);
        return;
      }

      // Delete the metadata record
      const { error: metadataError } = await supabase
        .from('field_metadata')
        .delete()
        .eq('id', fieldId);

      if (metadataError) {
        console.error('Error deleting field metadata:', metadataError);
      }

      alert('Field deleted successfully!');
      fetchFieldMetadata(selectedObject);
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

  const isSystemObject = (objectName: string) => {
    return ['clients', 'channel_partners', 'billing', 'users'].includes(objectName);
  };

  const getFieldIcon = (dataType: string, isReference: boolean = false) => {
    if (isReference) return '🔗';
    
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

  // Auto-generate display label from API name
  const generateDisplayLabel = (apiName: string) => {
    return apiName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (!hasAdminAccess) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">Only administrators can access the settings panel.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-600">Configure objects, fields, layouts, and users</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Admin Only
        </div>
      </div>

      {/* Main Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Settings Tabs">
            {settingsTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <div className="text-left">
                  <div>{tab.label}</div>
                  <div className="text-xs text-gray-400 font-normal">{tab.description}</div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Objects & Fields Tab */}
          {activeTab === 'objects' && (
            <div className="flex gap-6 h-[600px]">
              {/* Left Panel - 30% */}
              <div className="w-[30%] space-y-4">
                {/* Objects List */}
                <div className="bg-gray-50 rounded-lg p-4 h-[45%] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Objects</h3>
                    <button
                      onClick={() => setShowCreateObject(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      + New
                    </button>
                  </div>
                  
                  {showCreateObject && (
                    <div className="mb-3 p-3 bg-white rounded border">
                      <input
                        type="text"
                        value={newObjectName}
                        onChange={(e) => setNewObjectName(e.target.value)}
                        placeholder="Object name"
                        className="w-full px-2 py-1 text-sm border rounded mb-2"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={handleCreateObject}
                          disabled={creatingObject}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded disabled:opacity-50"
                        >
                          {creatingObject ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          onClick={() => setShowCreateObject(false)}
                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {objects.map((object) => (
                      <div
                        key={object.table_name}
                        onClick={() => setSelectedObject(object.table_name)}
                        className={`
                          p-2 rounded cursor-pointer transition-colors flex items-center gap-2
                          ${selectedObject === object.table_name 
                            ? 'bg-blue-100 border border-blue-300' 
                            : 'bg-white hover:bg-gray-100 border border-gray-200'
                          }
                        `}
                      >
                        <span className="text-lg">{getObjectIcon(object.table_name)}</span>
                        <div>
                          <div className="font-medium text-sm">{object.table_name}</div>
                          {isSystemObject(object.table_name) && (
                            <span className="text-xs text-blue-600">System</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Panel Tabs */}
                <div className="bg-gray-50 rounded-lg p-4 h-[50%]">
                  <div className="flex border-b border-gray-200 mb-3">
                    {[
                      { id: 'fields', label: 'Fields', icon: '📝' },
                      { id: 'layout', label: 'Layout', icon: '📐' },
                      { id: 'validation', label: 'Rules', icon: '✅' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setRightPanelTab(tab.id as any)}
                        className={`
                          px-3 py-2 text-sm font-medium border-b-2 transition-colors
                          ${rightPanelTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                          }
                        `}
                      >
                        <span className="mr-1">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {selectedObject ? (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 mb-2">
                        {selectedObject}
                      </div>
                      <div className="text-gray-600">
                        {rightPanelTab === 'fields' && `${fieldMetadata.length} fields`}
                        {rightPanelTab === 'layout' && 'Configure page layout'}
                        {rightPanelTab === 'validation' && 'Set validation rules'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Select an object to manage its properties
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel - 70% */}
              <div className="w-[70%] bg-gray-50 rounded-lg p-4 overflow-y-auto">
                {selectedObject ? (
                  <>
                    {/* Fields Tab */}
                    {rightPanelTab === 'fields' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Fields for {selectedObject}</h3>
                          <button
                            onClick={() => setShowCreateField(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                          >
                            + Add Field
                          </button>
                        </div>

                        {showCreateField && (
                          <div className="bg-white rounded-lg p-4 border">
                            <h4 className="font-medium mb-3">Add New Field</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium mb-1">API Name *</label>
                                <input
                                  type="text"
                                  value={newField.api_name}
                                  onChange={(e) => {
                                    const apiName = e.target.value;
                                    setNewField({ 
                                      ...newField, 
                                      api_name: apiName,
                                      display_label: apiName ? generateDisplayLabel(apiName) : ''
                                    });
                                  }}
                                  className="w-full px-3 py-2 border rounded"
                                  placeholder="field_name"
                                />
                                <p className="text-xs text-gray-500 mt-1">Database column name (snake_case)</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Display Label *</label>
                                <input
                                  type="text"
                                  value={newField.display_label}
                                  onChange={(e) => setNewField({ ...newField, display_label: e.target.value })}
                                  className="w-full px-3 py-2 border rounded"
                                  placeholder="Field Name"
                                />
                                <p className="text-xs text-gray-500 mt-1">Label shown in UI</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Data Type</label>
                                <select
                                  value={newField.field_type}
                                  onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
                                  className="w-full px-3 py-2 border rounded"
                                >
                                  {dataTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Section</label>
                                <select
                                  value={newField.section}
                                  onChange={(e) => setNewField({ ...newField, section: e.target.value as any })}
                                  className="w-full px-3 py-2 border rounded"
                                >
                                  <option value="basic">Basic Information</option>
                                  <option value="details">Details</option>
                                  <option value="system">System</option>
                                </select>
                              </div>

                              {/* Reference Field Options */}
                              {newField.field_type === 'reference' && (
                                <>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Reference Table *</label>
                                    <select
                                      value={newField.reference_table}
                                      onChange={(e) => setNewField({ ...newField, reference_table: e.target.value })}
                                      className="w-full px-3 py-2 border rounded"
                                    >
                                      <option value="">Select table to reference</option>
                                      {objects.map((object) => (
                                        <option key={object.table_name} value={object.table_name}>
                                          {object.table_name}
                                        </option>
                                      ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Table this field references</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium mb-1">Display Field *</label>
                                    <input
                                      type="text"
                                      value={newField.reference_display_field}
                                      onChange={(e) => setNewField({ ...newField, reference_display_field: e.target.value })}
                                      className="w-full px-3 py-2 border rounded"
                                      placeholder="name"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Field to display in dropdowns (usually 'name')</p>
                                  </div>
                                </>
                              )}

                              {newField.field_type !== 'reference' && (
                                <div>
                                  <label className="block text-sm font-medium mb-1">Default Value</label>
                                  <input
                                    type="text"
                                    value={newField.default_value}
                                    onChange={(e) => setNewField({ ...newField, default_value: e.target.value })}
                                    className="w-full px-3 py-2 border rounded"
                                    placeholder="Optional"
                                  />
                                </div>
                              )}

                              <div>
                                <label className="block text-sm font-medium mb-1">Width</label>
                                <select
                                  value={newField.width}
                                  onChange={(e) => setNewField({ ...newField, width: e.target.value as any })}
                                  className="w-full px-3 py-2 border rounded"
                                >
                                  <option value="half">Half Width</option>
                                  <option value="full">Full Width</option>
                                </select>
                              </div>
                              <div className="col-span-2 flex items-center space-x-4 pt-2">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={newField.is_required}
                                    onChange={(e) => setNewField({ ...newField, is_required: e.target.checked })}
                                    className="mr-2"
                                  />
                                  Required Field
                                </label>
                              </div>
                            </div>

                            {/* Reference Field Info */}
                            {newField.field_type === 'reference' && (
                              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                                <h5 className="text-sm font-medium text-blue-900 mb-1">🔗 Reference Field</h5>
                                <div className="text-sm text-blue-700 space-y-1">
                                  <p>• Creates a foreign key relationship to another table</p>
                                  <p>• Automatically generates dropdown UI with related records</p>
                                  <p>• Enforces referential integrity in the database</p>
                                  <p>• Enables join queries and related data display</p>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={handleCreateField}
                                disabled={creatingField}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
                              >
                                {creatingField ? 'Adding...' : 'Add Field'}
                              </button>
                              <button
                                onClick={resetNewField}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {fieldMetadata.length > 0 ? (
                            fieldMetadata.map((field) => (
                              <div
                                key={field.id}
                                className="bg-white rounded-lg p-3 border flex items-center justify-between"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">
                                    {getFieldIcon(field.field_type, field.reference_table !== null)}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{field.display_label}</span>
                                      <span className="text-xs text-gray-500">({field.api_name})</span>
                                      {field.is_system_field && (
                                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                                          System
                                        </span>
                                      )}
                                      {field.is_required && (
                                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                                          Required
                                        </span>
                                      )}
                                      {field.reference_table && (
                                        <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                                          → {field.reference_table}
                                        </span>
                                      )}
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                        {field.section}
                                      </span>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {field.field_type}
                                      {field.reference_table && ` (references ${field.reference_table}.${field.reference_display_field})`}
                                      {field.default_value && ` • Default: ${field.default_value}`}
                                    </div>
                                  </div>
                                </div>
                                {!field.is_system_field && (
                                  <button
                                    onClick={() => handleDeleteField(field.id, field.api_name)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                    title="Delete field"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8">
                              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <h3 className="mt-2 text-sm font-medium text-gray-900">No fields found</h3>
                              <p className="mt-1 text-sm text-gray-500">Add fields to start building your object structure.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Layout Tab */}
                    {rightPanelTab === 'layout' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Page Layout for {selectedObject}</h3>
                        <p className="text-sm text-gray-600">Configure how fields are displayed on the record page</p>
                        
                        <div className="space-y-4">
                          {['basic', 'details', 'system'].map((section) => (
                            <div key={section} className="bg-white rounded-lg p-4 border">
                              <h4 className="font-medium mb-3 capitalize">{section} Information</h4>
                              <div className="space-y-2">
                                {fieldMetadata
                                  .filter(field => field.section === section)
                                  .map((field) => (
                                    <div key={field.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={field.is_visible}
                                          onChange={(e) => {
                                            // Update field visibility
                                            setFieldMetadata(prev => 
                                              prev.map(f => 
                                                f.id === field.id 
                                                  ? { ...f, is_visible: e.target.checked }
                                                  : f
                                              )
                                            );
                                          }}
                                        />
                                        <span className="font-medium">{field.display_label}</span>
                                        <span className="text-sm text-gray-500">({field.api_name})</span>
                                        {field.reference_table && (
                                          <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                                            🔗 {field.reference_table}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={field.width}
                                          onChange={(e) => {
                                            setFieldMetadata(prev => 
                                              prev.map(f => 
                                                f.id === field.id 
                                                  ? { ...f, width: e.target.value as 'full' | 'half' }
                                                  : f
                                              )
                                            );
                                          }}
                                          className="text-sm border rounded px-2 py-1"
                                        >
                                          <option value="half">Half Width</option>
                                          <option value="full">Full Width</option>
                                        </select>
                                        <input
                                          type="checkbox"
                                          checked={field.is_required}
                                          onChange={(e) => {
                                            setFieldMetadata(prev => 
                                              prev.map(f => 
                                                f.id === field.id 
                                                  ? { ...f, is_required: e.target.checked }
                                                  : f
                                              )
                                            );
                                          }}
                                          title="Required field"
                                        />
                                        <span className="text-xs text-gray-500">Req</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validation Tab */}
                    {rightPanelTab === 'validation' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Validation Rules for {selectedObject}</h3>
                          <button
                            onClick={() => setShowCreateRule(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm"
                          >
                            + Add Rule
                          </button>
                        </div>

                        {showCreateRule && (
                          <div className="bg-white rounded-lg p-4 border">
                            <h4 className="font-medium mb-3">Add Validation Rule</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium mb-1">Field</label>
                                <select
                                  value={newRule.field}
                                  onChange={(e) => setNewRule({ ...newRule, field: e.target.value })}
                                  className="w-full px-3 py-2 border rounded"
                                >
                                  <option value="">Select field...</option>
                                  {fieldMetadata.map((field) => (
                                    <option key={field.api_name} value={field.api_name}>
                                      {field.display_label} ({field.api_name})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Validation Type</label>
                                <select
                                  value={newRule.type}
                                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                                  className="w-full px-3 py-2 border rounded"
                                >
                                  {validationTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Value</label>
                                <input
                                  type="text"
                                  value={newRule.value}
                                  onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                                  className="w-full px-3 py-2 border rounded"
                                  placeholder="Validation value"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Error Message</label>
                                <input
                                  type="text"
                                  value={newRule.message}
                                  onChange={(e) => setNewRule({ ...newRule, message: e.target.value })}
                                  className="w-full px-3 py-2 border rounded"
                                  placeholder="Error message"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <button
                                onClick={() => {
                                  setValidationRules(prev => [...prev, { ...newRule, id: Date.now().toString() }]);
                                  setNewRule({ field: '', type: 'required', value: '', message: '', enabled: true });
                                  setShowCreateRule(false);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                              >
                                Add Rule
                              </button>
                              <button
                                onClick={() => setShowCreateRule(false)}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {validationRules.map((rule) => (
                            <div key={rule.id} className="bg-white rounded-lg p-3 border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{rule.field} - {rule.type}</div>
                                  <div className="text-sm text-gray-600">"{rule.message}"</div>
                                  {rule.value && (
                                    <div className="text-xs text-gray-500">Value: {rule.value}</div>
                                  )}
                                </div>
                                <button
                                  onClick={() => setValidationRules(prev => prev.filter(r => r.id !== rule.id))}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Select an object</h3>
                    <p className="mt-1 text-sm text-gray-500">Choose an object from the left panel to manage its properties.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && <UserCreator />}

          {/* Validation Tab */}
          {activeTab === 'validation' && (
            <div className="text-center py-12">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Global Validation Rules</h2>
              <p className="text-gray-600">Global validation rules coming soon...</p>
            </div>
          )}
        </div>
      </div>

      {/* Message Display */}
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