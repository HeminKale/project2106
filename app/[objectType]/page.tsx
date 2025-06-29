'use client';

import { useAuth } from '../components/AuthProvider';
import Layout from '../components/Layout';
import LoginForm from '../components/LoginForm';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Add LayoutBlock and FieldMetadata interfaces for modal
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
  section: string;
  width: 'half' | 'full';
  is_visible: boolean;
  is_system_field: boolean;
  reference_table: string | null;
  reference_display_field: string | null;
}
interface LayoutBlock {
  id: string;
  table_name: string;
  block_type: 'field' | 'related_list';
  field_id?: string;
  label: string;
  section: string;
  display_order: number;
  width?: string;
  is_visible?: boolean;
  field_metadata?: FieldMetadata;
}

export default function DynamicObjectListPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const objectType = params.objectType as string;
  const [columns, setColumns] = useState<string[]>([]);
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>([]);
  const [newRecord, setNewRecord] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [showEditViewModal, setShowEditViewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const columnsInitialized = useRef(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (objectType && user) {
      fetchColumnsAndRecords();
    }
    // eslint-disable-next-line
  }, [objectType, user]);

  // Set initial visible columns when columns are first loaded
  useEffect(() => {
    if (columns.length > 0 && !columnsInitialized.current) {
      loadUserView();
      columnsInitialized.current = true;
    }
  }, [columns]);

  // Reset initialization flag when object type changes
  useEffect(() => {
    columnsInitialized.current = false;
  }, [objectType]);

  // Fetch layout blocks for the create modal
  useEffect(() => {
    if (objectType && user && showCreateModal) {
      fetchLayoutBlocks();
    }
    // eslint-disable-next-line
  }, [objectType, user, showCreateModal]);

  // Refresh field metadata when component is focused (e.g., after editing fields in Object Manager)
  useEffect(() => {
    const handleFocus = () => {
      if (objectType && user && fieldMetadata.length > 0) {
        // Refetch field metadata to get any updates from Object Manager
        supabase.rpc('get_field_metadata', {
          table_name_param: objectType
        }).then(({ data, error }) => {
          if (!error && data) {
            setFieldMetadata(data);
          }
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [objectType, user, fieldMetadata.length]);

  const fetchColumnsAndRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch columns
      const { data: cols, error: colError } = await supabase.rpc('get_table_columns', {
        table_name_param: objectType
      });
      if (colError) throw colError;
      const colNames = (cols || []).map((col: any) => col.column_name);
      setColumns(colNames);

      // Fetch field metadata for display labels
      const { data: fieldData, error: fieldError } = await supabase.rpc('get_field_metadata', {
        table_name_param: objectType
      });
      if (fieldError) {
        console.warn('Could not fetch field metadata:', fieldError);
        setFieldMetadata([]);
      } else {
        setFieldMetadata(fieldData || []);
      }

      // Fetch records
      const { data: recs, error: recError } = await supabase
        .from(objectType)
        .select('*')
        .order('created_at', { ascending: false });
      if (recError) throw recError;
      setRecords(recs || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchLayoutBlocks = async () => {
    const { data, error } = await supabase
      .from('layout_blocks')
      .select('*, field_metadata(*)')
      .eq('table_name', objectType)
      .eq('is_visible', true)
      .order('section')
      .order('display_order');
    if (!error) setLayoutBlocks(data || []);
  };

  // Helper to group layout blocks by section
  const groupedSections = layoutBlocks.reduce((acc: Record<string, LayoutBlock[]>, block) => {
    if (block.block_type !== 'field') return acc;
    if (!acc[block.section]) acc[block.section] = [];
    acc[block.section].push(block);
    return acc;
  }, {} as Record<string, LayoutBlock[]>);

  // Render input for a field (copied from [id]/page.tsx)
  const renderFieldInput = (block: LayoutBlock, value: any) => {
    const handleChange = (newValue: any) => {
      if (block.field_metadata?.api_name) {
        setNewRecord((prev: any) => ({ ...prev, [block.field_metadata!.api_name]: newValue }));
      }
    };
    switch (block.field_metadata?.field_type) {
      case 'date':
      case 'timestamptz':
        return (
          <input
            type="date"
            value={value ? value.substring(0, 10) : ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
      case 'boolean':
        return (
          <select
            value={value ? 'true' : 'false'}
            onChange={(e) => handleChange(e.target.value === 'true')}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      case 'number':
      case 'integer':
      case 'decimal':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
      case 'text':
      case 'varchar':
      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Ensure table has standard system fields
      await ensureSystemFields();
      
      // Prepare the data for insertion
      const insertData = { ...newRecord };
      
      // Add system fields only if they exist in the table schema
      const currentTime = new Date().toISOString();
      
      if (columns.includes('created_at')) {
        insertData.created_at = currentTime;
      }
      if (columns.includes('updated_at')) {
        insertData.updated_at = currentTime;
      }
      if (columns.includes('created_by') && user?.id) {
        insertData.created_by = user.id;
      }
      if (columns.includes('updated_by') && user?.id) {
        insertData.updated_by = user.id;
      }

      console.log('💾 Inserting new record:', insertData);

      const { data, error } = await supabase
        .from(objectType)
        .insert(insertData)
        .select();

      if (error) {
        console.error('❌ Insert error:', error);
        alert('Error creating record: ' + error.message);
        return;
      }

      console.log('✅ Record created successfully:', data);
      
      // Close modal and refresh list
      setShowCreateModal(false);
      setNewRecord({});
      fetchColumnsAndRecords();
      
      alert('Record created successfully!');
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      alert('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Function to ensure table has standard system fields
  const ensureSystemFields = async () => {
    try {
      const systemFields = [
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        { name: 'created_by', type: 'uuid', default: null },
        { name: 'updated_by', type: 'uuid', default: null }
      ];

      for (const field of systemFields) {
        if (!columns.includes(field.name)) {
          console.log(`🔧 Adding missing system field: ${field.name}`);
          const sql = `ALTER TABLE ${objectType} ADD COLUMN ${field.name} ${field.type}${field.default ? ` DEFAULT ${field.default}` : ''}`;
          const { error } = await supabase.rpc('execute_sql', { sql });
          if (error) {
            console.warn(`⚠️ Could not add ${field.name}: ${error.message}`);
          } else {
            console.log(`✅ Added ${field.name} to ${objectType}`);
          }
        }
      }
      
      // Refresh columns list after adding fields
      await fetchColumnsAndRecords();
    } catch (err) {
      console.warn('⚠️ Could not ensure system fields:', err);
    }
  };

  const handleColumnToggle = (columnName: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnName) 
        ? prev.filter(col => col !== columnName)
        : [...prev, columnName]
    );
  };

  const handleSaveView = async () => {
    if (!user || !objectType) return;

    try {
      console.log('💾 Saving view for:', objectType);
      console.log('👤 User ID:', user.id);
      console.log('📋 Visible columns:', visibleColumns);
      
      const { error } = await supabase
        .from('list_views')
        .upsert({
          user_id: user.id,
          object_type: objectType,
          visible_columns: visibleColumns,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,object_type'
        });

      if (error) {
        console.error('❌ Failed to save view:', error);
        alert('Failed to save view: ' + error.message);
      } else {
        console.log('✅ View saved successfully');
        setShowEditViewModal(false);
      }
    } catch (err) {
      console.error('❌ Error saving view:', err);
      alert('Failed to save view');
    }
  };

  // Load user's saved view from Supabase
  const loadUserView = async () => {
    if (user && objectType && columns.length > 0) {
      try {
        console.log('🔄 Loading user view for:', objectType);
        console.log('👤 User ID:', user.id);
        
        const { data, error } = await supabase
          .from('list_views')
          .select('visible_columns')
          .eq('user_id', user.id)
          .eq('object_type', objectType)
          .single();

        console.log('📊 Database response:', { data, error });

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('❌ Error loading user view:', error);
        }

        if (data?.visible_columns) {
          console.log('✅ Found saved view:', data.visible_columns);
          // Filter out any columns that no longer exist
          const validColumns = data.visible_columns.filter((col: string) => 
            columns.includes(col)
          );
          console.log('🔍 Valid columns:', validColumns);
          setVisibleColumns(validColumns.length > 0 ? validColumns : columns);
        } else {
          console.log('📋 No saved view found, using all columns');
          setVisibleColumns(columns); // fallback to full view
        }
      } catch (err) {
        console.error('❌ Error loading user view:', err);
        setVisibleColumns(columns); // fallback to full view
      }
    }
  };

  // Helper function to format date/time fields
  const formatFieldValue = (value: any, columnName: string) => {
    if (value === null || value === undefined) return '';
    
    // Check if it's a date/time field
    if (typeof value === 'string' && (value.includes('T') || value.includes('-'))) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          // If it's a timestamp, show only the date part
          if (value.includes('T')) {
            return date.toLocaleDateString();
          }
          return date.toLocaleDateString();
        }
      } catch (e) {
        // If date parsing fails, return as is
      }
    }
    
    return String(value);
  };

  // Helper function to get display label for a column
  const getDisplayLabel = (columnName: string) => {
    const field = fieldMetadata.find(fm => fm.api_name === columnName);
    return field?.display_label || columnName.replace(/_/g, ' ');
  };

  // Filter records based on search query
  const filteredRecords = records.filter(record => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return visibleColumns.some(column => {
      const value = record[column];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(query);
    });
  });

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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{objectType.charAt(0).toUpperCase() + objectType.slice(1)}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchColumnsAndRecords();
                setMessage('✅ View refreshed');
                setTimeout(() => setMessage(''), 3000);
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
              title="Refresh view and field metadata"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => setShowEditViewModal(true)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit View
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New
            </button>
          </div>
        </div>
        {showEditViewModal && (
          <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Edit View - Select Columns
                      </h3>
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 mb-4">
                          Select which columns to display in the table view:
                        </p>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {columns.map((column) => (
                            <label key={column} className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={visibleColumns.includes(column)}
                                onChange={() => handleColumnToggle(column)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                {getDisplayLabel(column)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleSaveView}
                  >
                    Save View
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowEditViewModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showCreateModal && (
          <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                        Create New {objectType.charAt(0).toUpperCase() + objectType.slice(1)}
                      </h3>
                      <div className="mt-4 space-y-6">
                        {Object.keys(groupedSections).length === 0 ? (
                          <div className="text-gray-500">No fields configured in layout.</div>
                        ) : (
                          Object.entries(groupedSections).map(([section, blocks]) => (
                            <div key={section} className="mb-4">
                              <h4 className="text-md font-semibold text-gray-700 mb-2 capitalize">{section}</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {blocks.map((block) => (
                                  <div key={block.id}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      {block.label}
                                      {block.field_metadata?.is_required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {renderFieldInput(block, newRecord[block.field_metadata?.api_name || ''])}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowCreateModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Message Display */}
        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            message.includes('✅') 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder={`Search ${objectType}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading records</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button 
                  onClick={fetchColumnsAndRecords}
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-x-auto">
            {/* Search Results Info */}
            {searchQuery && (
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
                <p className="text-sm text-blue-700">
                  Showing {filteredRecords.length} of {records.length} records
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              </div>
            )}
            
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.map((col) => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getDisplayLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-gray-500">
                      {searchQuery ? (
                        <div>
                          <p className="text-sm">No records found matching "{searchQuery}"</p>
                          <button 
                            onClick={() => setSearchQuery('')}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-500 underline"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm">No records found</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors duration-150">
                      {visibleColumns.map((col) => (
                        <td key={col} className="px-6 py-4 whitespace-nowrap">
                          {col === 'name' ? (
                            <Link 
                              href={`/${objectType}/${record.id}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {record[col] !== undefined && record[col] !== null ? String(record[col]) : 'Unnamed'}
                            </Link>
                          ) : (
                            record[col] !== undefined && record[col] !== null ? formatFieldValue(record[col], col) : ''
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
} 