'use client';

import { useAuth } from '../../components/AuthProvider';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Layout from '../../components/Layout';
import DocumentManager from '../../components/DocumentManager';
import LoginForm from '../../components/LoginForm';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

interface LayoutBlock {
  id: string;
  table_name: string;
  block_type: 'section' | 'field';
  field_id: string | null;
  section: string;
  display_order: number;
  label: string;
  is_visible: boolean;
  field_metadata?: {
    id: string;
    api_name: string;
    display_label: string;
    field_type: string;
    is_required: boolean;
    is_nullable: boolean;
    default_value: string | null;
    validation_rules: any[];
    width: 'half' | 'full';
    is_system_field: boolean;
    reference_table: string | null;
    reference_display_field: string | null;
  };
}

interface ObjectData {
  id: string;
  [key: string]: any;
}

interface Tab {
  id: string;
  label: string;
  icon: string;
}

// Default tabs for different object types
const getDefaultTabs = (objectType: string): Tab[] => {
  switch (objectType) {
    case 'clients':
      return [
        { id: 'information', label: 'Client Information', icon: '👤' },
        { id: 'documents', label: 'Document Management', icon: '📄' },
        { id: 'billing', label: 'Billing Management', icon: '💰' },
        { id: 'notes', label: 'Notes', icon: '📝' }
      ];
    case 'channel-partners':
      return [
        { id: 'information', label: 'Partner Information', icon: '🤝' },
        { id: 'clients', label: 'Clients', icon: '👥' },
        { id: 'billing', label: 'Billing Management', icon: '💰' },
        { id: 'notes', label: 'Notes', icon: '📝' }
      ];
    default:
      return [
        { id: 'information', label: 'Information', icon: '📋' },
        { id: 'notes', label: 'Notes', icon: '📝' }
      ];
  }
};

// Get the singular form of object type for display
const getObjectDisplayName = (objectType: string): string => {
  switch (objectType) {
    case 'clients': return 'Client';
    case 'channel-partners': return 'Channel Partner';
    case 'users': return 'User';
    case 'heroes': return 'Hero';
    default: return objectType.charAt(0).toUpperCase() + objectType.slice(1, -1); // Remove 's' and capitalize
  }
};

// Get the table name from object type
const getTableName = (objectType: string): string => {
  switch (objectType) {
    case 'clients': return 'clients';
    case 'channel-partners': return 'channel_partners';
    case 'users': return 'users';
    case 'heroes': return 'heroes';
    default: return objectType.replace('-', '_');
  }
};

export default function DynamicObjectDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const objectType = params.objectType as string;
  const objectId = params.id as string;
  
  const [objectData, setObjectData] = useState<ObjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedObject, setEditedObject] = useState<ObjectData | null>(null);
  const [activeTab, setActiveTab] = useState('information');
  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>([]);
  const [availableTabs, setAvailableTabs] = useState<Tab[]>([]);

  const tableName = getTableName(objectType);
  const tabs = getDefaultTabs(objectType);
  const objectDisplayName = getObjectDisplayName(objectType);

  useEffect(() => {
    if (objectId && user && objectType) {
      fetchObjectData();
      fetchAvailableTabs();
    }
  }, [objectId, user, objectType]);

  useEffect(() => {
    if (objectData) {
      setEditedObject({ ...objectData });
    }
  }, [objectData]);

  // Fetch available tabs from layout_blocks
  const fetchAvailableTabs = async () => {
    try {
      const { data, error } = await supabase
        .from('layout_blocks')
        .select('tab_type')
        .eq('table_name', tableName)
        .eq('is_visible', true)
        .not('tab_type', 'is', null);

      if (!error && data) {
        const uniqueTabs = Array.from(new Set(data.map(block => block.tab_type)))
          .filter(tabType => tabType) // Remove null/undefined
          .map(tabType => {
            // Map tab_type to Tab object
            const tabConfig = tabs.find(t => t.id === tabType);
            return tabConfig || {
              id: tabType,
              label: tabType.charAt(0).toUpperCase() + tabType.slice(1),
              icon: '📋'
            };
          });
        
        setAvailableTabs(uniqueTabs);
        
        // Set first available tab as active if current active tab is not available
        if (uniqueTabs.length > 0 && !uniqueTabs.find(t => t.id === activeTab)) {
          setActiveTab(uniqueTabs[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching available tabs:', err);
      // Fallback to default tabs if error
      setAvailableTabs(tabs);
    }
  };

  // Refetch layout blocks when active tab changes
  useEffect(() => {
    if (objectId && user && objectType && activeTab) {
      fetchLayoutBlocks();
    }
  }, [activeTab, objectId, user, objectType]);

  const fetchLayoutBlocks = async () => {
    try {
      console.log(`🔍 Fetching layout blocks for ${tableName} table, tab: ${activeTab}`);
      
      // Fetch layout blocks for the CURRENT active tab
      const { data, error } = await supabase
        .from('layout_blocks')
        .select(`
          *,
          field_metadata(*)
        `)
        .eq('table_name', tableName)
        .eq('tab_type', activeTab)  // Filter by active tab
        .eq('is_visible', true)
        .order('display_order');

      if (error) {
        console.error('❌ Error fetching layout blocks:', error);
      } else {
        console.log('✅ Fetched layout blocks:', data);
        console.log('📊 Layout blocks details:', data?.map(block => ({
          id: block.id,
          table_name: block.table_name,
          tab_type: block.tab_type,
          block_type: block.block_type,
          section: block.section,
          display_order: block.display_order,
          label: block.label,
          field_metadata: block.field_metadata?.display_label
        })));
        setLayoutBlocks(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching layout blocks:', err);
    }
  };

  const fetchObjectData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build the select query based on object type
      let selectQuery = '*';
      if (objectType === 'clients') {
        selectQuery = `
          *,
          channel_partner:referred_by(id, name, country, email),
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `;
      } else if (objectType === 'channel-partners') {
        selectQuery = `
          *,
          creator:created_by(full_name, email),
          updater:updated_by(full_name, email)
        `;
      }

      const { data, error } = await supabase
        .from(tableName)
        .select(selectQuery)
        .eq('id', objectId)
        .single();

      if (error) {
        console.error('❌ Supabase error:', error);
        setError(error.message || 'An error occurred while fetching data');
        setObjectData(null);
      } else if (data && typeof data === 'object' && 'id' in data) {
        console.log('✅ Fetched object data:', data);
        setObjectData(data as ObjectData);
      } else {
        setError('No data found');
        setObjectData(null);
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedObject || !objectData) return;
    
    setSaving(true);
    try {
      // Ensure table has standard system fields before saving
      await ensureSystemFields();
      
      const updateData = { ...editedObject };
      if ('id' in updateData) {
        delete (updateData as any).id; // Remove id from update data
      }
      
      // Only add updated_at if the column exists
      const { data: columns } = await supabase.rpc('get_table_columns', {
        table_name_param: tableName
      });
      const columnNames = (columns || []).map((col: any) => col.column_name);
      
      if (columnNames.includes('updated_at')) {
        updateData.updated_at = new Date().toISOString();
      }

      const { data: updateResult, error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', objectData.id)
        .select('*');

      if (updateError) {
        console.error('❌ Update error:', updateError);
        alert('Error saving changes: ' + updateError.message);
        return;
      }

      const updatedData = Array.isArray(updateResult) ? updateResult[0] : updateResult;
      setObjectData(updatedData);
      setEditedObject(updatedData);
      setIsEditing(false);
    } catch (err) {
      console.error('❌ Unexpected save error:', err);
      alert('An unexpected error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  // Function to ensure table has standard system fields
  const ensureSystemFields = async () => {
    try {
      const { data: columns } = await supabase.rpc('get_table_columns', {
        table_name_param: tableName
      });
      const columnNames = (columns || []).map((col: any) => col.column_name);
      
      const systemFields = [
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
        { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        { name: 'created_by', type: 'uuid', default: null },
        { name: 'updated_by', type: 'uuid', default: null }
      ];

      for (const field of systemFields) {
        if (!columnNames.includes(field.name)) {
          console.log(`🔧 Adding missing system field: ${field.name}`);
          const sql = `ALTER TABLE ${tableName} ADD COLUMN ${field.name} ${field.type}${field.default ? ` DEFAULT ${field.default}` : ''}`;
          const { error } = await supabase.rpc('execute_sql', { sql });
          if (error) {
            console.warn(`⚠️ Could not add ${field.name}: ${error.message}`);
          } else {
            console.log(`✅ Added ${field.name} to ${tableName}`);
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not ensure system fields:', err);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (objectData) {
      setEditedObject({ ...objectData });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const renderFieldValue = (block: LayoutBlock, value: any) => {
    if (value === null || value === undefined) return 'N/A';
    
    switch (block.field_metadata?.field_type) {
      case 'date':
      case 'timestamptz':
        return formatDate(value);
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'reference':
        // Handle reference fields based on object type
        if (objectType === 'clients' && block.field_metadata?.api_name === 'referred_by' && objectData?.channel_partner) {
          return objectData.channel_partner.name;
        }
        return value;
      default:
        return value;
    }
  };

  const renderFieldInput = (block: LayoutBlock, value: any) => {
    const handleChange = (newValue: any) => {
      if (editedObject && block.field_metadata?.api_name) {
        const apiName = block.field_metadata.api_name;
        setEditedObject({ ...editedObject, [apiName]: newValue });
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

  // Handle 'new' route for create form
  if (objectId === 'new') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Create New {objectDisplayName}</h1>
          {/* TODO: Render your create form here */}
          <div className="text-gray-500">(Create form goes here)</div>
        </div>
      </Layout>
    );
  }

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg font-semibold">Loading {objectDisplayName.toLowerCase()} details...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <LoginForm />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-700">{error}</p>
          <button 
            onClick={() => fetchObjectData()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  if (!objectData) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">{objectDisplayName} not found.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen p-8 bg-gray-100">
        <div className="bg-white rounded-lg shadow-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-gray-900">
              {objectData.name || objectData.title || `${objectDisplayName} ${objectData.id}`}
            </h1>
            <div className="flex space-x-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Edit {objectDisplayName}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`
                  }
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div>
            {/* Only show tabs if there are available tabs */}
            {availableTabs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium mb-2">No tabs configured</p>
                <p className="text-sm">Configure tabs and layout in Object Manager → Page Layout.</p>
              </div>
            ) : (
              <>
                {/* Information tab - Dynamic layout */}
                {activeTab === 'information' && (
                  <div className="space-y-8 p-6">
                    {/* Dynamic Sections from layout_blocks */}
                    {(() => {
                      // Group layout blocks by section
                      const groupedSections = layoutBlocks
                        .filter(block => block.block_type === 'field' && block.is_visible)
                        .reduce((acc, block) => {
                          if (!acc[block.section]) {
                            acc[block.section] = [];
                          }
                          acc[block.section].push(block);
                          return acc;
                        }, {} as Record<string, LayoutBlock[]>);

                      // Sort sections by display order
                      const sortedSections = Object.keys(groupedSections).sort((a, b) => {
                        const orderA = Math.min(...groupedSections[a].map(block => block.display_order));
                        const orderB = Math.min(...groupedSections[b].map(block => block.display_order));
                        return orderA - orderB;
                      });

                      return sortedSections.map(section => {
                        const sectionBlocks = groupedSections[section]
                          .sort((a, b) => a.display_order - b.display_order);

                        if (sectionBlocks.length === 0) return null;

                        return (
                          <div key={section} className="space-y-4">
                            <h2 className="text-lg font-bold text-gray-900">
                              {section.charAt(0).toUpperCase() + section.slice(1)}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                              {sectionBlocks.map(block => {
                                if (!block.field_metadata) return null;
                                
                                const fieldValue = objectData[block.field_metadata.api_name];
                                const editedValue = editedObject?.[block.field_metadata.api_name];
                                
                                return (
                                  <div key={block.id} className={block.field_metadata.width === 'full' ? 'col-span-2' : ''}>
                                    <p className="text-sm font-medium text-gray-500">{block.field_metadata.display_label}</p>
                                    {!isEditing ? (
                                      <p className="mt-1 text-sm text-gray-900">
                                        {renderFieldValue(block, fieldValue)}
                                      </p>
                                    ) : (
                                      renderFieldInput(block, editedValue)
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Show message if no layout blocks found */}
                    {layoutBlocks.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No layout configuration found for information tab.</p>
                        <p className="text-sm mt-2">Configure this tab's layout in Object Manager → Page Layout.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Documents tab - Functional component */}
                {activeTab === 'documents' && objectType === 'clients' && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Document Actions</h2>
                    <DocumentManager
                      clientId={objectData.id}
                      onDraftGenerated={async (url) => {
                        console.log('Draft generated:', url);
                        // Update the client data with the new draft URL
                        if (objectData) {
                          const updatedData = { ...objectData, draft_url: url, draft_uploaded: true };
                          setObjectData(updatedData);
                          setEditedObject(updatedData);
                        }
                      }}
                      onCertificateGenerated={async (url) => {
                        console.log('Certificate generated:', url);
                        // Update the client data with the new certificate URL
                        if (objectData) {
                          const updatedData = { ...objectData, certificate_file_url: url, certificate_sent: true };
                          setObjectData(updatedData);
                          setEditedObject(updatedData);
                        }
                      }}
                      clientStatus={objectData.status}
                      applicationFormUrl={objectData.application_form_url}
                      draftUrl={objectData.draft_url}
                      certificateUrl={objectData.certificate_file_url}
                    />
                  </div>
                )}

                {/* Billing tab - Dynamic layout */}
                {activeTab === 'billing' && (
                  <div className="space-y-8 p-6">
                    {/* Dynamic Sections from layout_blocks */}
                    {(() => {
                      console.log('🎯 Processing billing tab layout blocks:', layoutBlocks);
                      
                      // Group layout blocks by section
                      const groupedSections = layoutBlocks
                        .filter(block => block.block_type === 'field' && block.is_visible)
                        .reduce((acc, block) => {
                          if (!acc[block.section]) {
                            acc[block.section] = [];
                          }
                          acc[block.section].push(block);
                          return acc;
                        }, {} as Record<string, LayoutBlock[]>);

                      console.log('📂 Grouped sections:', Object.keys(groupedSections));

                      // Sort sections by display order
                      const sortedSections = Object.keys(groupedSections).sort((a, b) => {
                        const orderA = Math.min(...groupedSections[a].map(block => block.display_order));
                        const orderB = Math.min(...groupedSections[b].map(block => block.display_order));
                        return orderB - orderA;
                      });

                      console.log('📋 Sorted sections:', sortedSections);

                      return sortedSections.map(section => {
                        const sectionBlocks = groupedSections[section]
                          .sort((a, b) => a.display_order - b.display_order);

                        if (sectionBlocks.length === 0) return null;

                        console.log(`🏷️ Rendering section "${section}" with ${sectionBlocks.length} blocks`);

                        return (
                          <div key={section} className="space-y-4">
                            <h2 className="text-lg font-bold text-gray-900">
                              {section.charAt(0).toUpperCase() + section.slice(1)}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                              {sectionBlocks.map(block => {
                                if (!block.field_metadata) return null;
                                
                                const fieldValue = objectData[block.field_metadata.api_name];
                                const editedValue = editedObject?.[block.field_metadata.api_name];
                                
                                return (
                                  <div key={block.id} className={block.field_metadata.width === 'full' ? 'col-span-2' : ''}>
                                    <p className="text-sm font-medium text-gray-500">{block.field_metadata.display_label}</p>
                                    {!isEditing ? (
                                      <p className="mt-1 text-sm text-gray-900">
                                        {renderFieldValue(block, fieldValue)}
                                      </p>
                                    ) : (
                                      renderFieldInput(block, editedValue)
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Show message if no layout blocks found */}
                    {layoutBlocks.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No layout configuration found for billing tab.</p>
                        <p className="text-sm mt-2">Configure this tab's layout in Object Manager → Page Layout.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes tab - Simple functional component */}
                {activeTab === 'notes' && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Notes</h2>
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <div className="mb-4">
                        <textarea
                          placeholder="Add a note about this {objectDisplayName.toLowerCase()}..."
                          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={4}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                          Add Note
                        </button>
                      </div>
                      <div className="mt-6">
                        <h3 className="text-md font-semibold text-gray-700 mb-3">Previous Notes</h3>
                        <div className="space-y-3">
                          <div className="bg-white p-3 rounded border">
                            <p className="text-sm text-gray-600">No notes yet. Add your first note above.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other tabs - Dynamic layout fallback */}
                {activeTab && activeTab !== 'information' && activeTab !== 'documents' && activeTab !== 'billing' && activeTab !== 'notes' && (
                  <div className="space-y-8 p-6">
                    {/* Dynamic Sections from layout_blocks for other tabs */}
                    {(() => {
                      const groupedSections = layoutBlocks
                        .filter(block => block.block_type === 'field' && block.is_visible)
                        .reduce((acc, block) => {
                          if (!acc[block.section]) {
                            acc[block.section] = [];
                          }
                          acc[block.section].push(block);
                          return acc;
                        }, {} as Record<string, LayoutBlock[]>);

                      const sortedSections = Object.keys(groupedSections).sort((a, b) => {
                        const orderA = Math.min(...groupedSections[a].map(block => block.display_order));
                        const orderB = Math.min(...groupedSections[b].map(block => block.display_order));
                        return orderA - orderB;
                      });

                      return sortedSections.map(section => {
                        const sectionBlocks = groupedSections[section]
                          .sort((a, b) => a.display_order - b.display_order);

                        if (sectionBlocks.length === 0) return null;

                        return (
                          <div key={section} className="space-y-4">
                            <h2 className="text-lg font-bold text-gray-900">
                              {section.charAt(0).toUpperCase() + section.slice(1)}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                              {sectionBlocks.map(block => {
                                if (!block.field_metadata) return null;
                                
                                const fieldValue = objectData[block.field_metadata.api_name];
                                const editedValue = editedObject?.[block.field_metadata.api_name];
                                
                                return (
                                  <div key={block.id} className={block.field_metadata.width === 'full' ? 'col-span-2' : ''}>
                                    <p className="text-sm font-medium text-gray-500">{block.field_metadata.display_label}</p>
                                    {!isEditing ? (
                                      <p className="mt-1 text-sm text-gray-900">
                                        {renderFieldValue(block, fieldValue)}
                                      </p>
                                    ) : (
                                      renderFieldInput(block, editedValue)
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Show message if no layout blocks found for this tab */}
                    {layoutBlocks.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <p>No layout configuration found for {activeTab} tab.</p>
                        <p className="text-sm mt-2">Configure this tab's layout in Object Manager → Page Layout.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
} 