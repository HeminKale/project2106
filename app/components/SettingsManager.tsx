'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthProvider';
import UserCreator from './UserCreator';
import ProfileManager from './ProfileManager';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import FieldDragItem from './FieldDragItem';
import ObjectLayoutEditor from './ObjectLayoutEditor';
import { ToastProvider } from './Toast';
import TabSettingsPage from './TabSettingsPage';
import { formatErrorMessage, logError } from '../utils/errorHandler';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface DatabaseObject {
  table_name: string;
  label: string;
  table_schema: string;
  table_type: string;
}

export interface FieldMetadata {
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

export interface RelatedList {
  id: string;
  parent_table: string;
  child_table: string;
  foreign_key_field: string;
  label: string;
  display_columns: string[];
  section: string;
  display_order: number;
  is_visible: boolean;
}

interface SettingsTab {
  id: string;
  label: string;
  icon: string;
}

const mainSettingsTabs: SettingsTab[] = [
];

const homeSections = [
  { id: 'profile', label: 'Profile Settings', icon: '👤' },
  { id: 'users_roles', label: 'Users & Roles', icon: '👥' },
  { id: 'permission_sets', label: 'Permission Sets', icon: '🔑' },
  { id: 'tab_settings', label: 'Tab Settings', icon: '📑' },
  { id: 'system_settings', label: 'System Settings', icon: '⚙️' },
];

const objectManagerSections = [
  { id: 'details', label: 'Details', icon: '📋' },
  { id: 'fields', label: 'Fields', icon: '📝' },
  { id: 'layout', label: 'Page Layout', icon: '📝' },
  { id: 'validation', label: 'Validation Rules', icon: '✅' },
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

export const ItemTypes = {
  FIELD: 'field',
  RELATED_LIST: 'relatedList',
};

export default function SettingsManager({ initialActiveMainTab = 'home' }: { initialActiveMainTab?: string }) {
  return (
    <ToastProvider>
      <DndProvider backend={HTML5Backend}>
        <SettingsManagerContent initialActiveMainTab={initialActiveMainTab} />
      </DndProvider>
    </ToastProvider>
  );
}

function SettingsManagerContent({ initialActiveMainTab = 'home' }: { initialActiveMainTab?: string }) {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState(initialActiveMainTab);
  const [selectedHomeSection, setSelectedHomeSection] = useState<'profile' | 'users_roles' | 'permission_sets' | 'tab_settings' | 'system_settings'>('profile');
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [objects, setObjects] = useState<DatabaseObject[]>([]);
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'details' | 'fields' | 'layout' | 'validation'>('details');
  
  // Object search and filtering
  const [objectSearchQuery, setObjectSearchQuery] = useState('');
  const [filteredObjects, setFilteredObjects] = useState<DatabaseObject[]>([]);

  // Object editing state
  const [isEditingObject, setIsEditingObject] = useState(false);
  const [editingObjectLabel, setEditingObjectLabel] = useState('');

  // Profile management state
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', description: '' });
  const [editingProfile, setEditingProfile] = useState<{ id: string; name: string; description: string } | null>(null);

  // Tab management state
  const fetchTabs = async () => {
    try {
      const { data, error } = await supabase
        .from('tabs')
        .select('*')
        .order('name');
  
      if (error) throw error;
      setTabs(data || []);
    } catch (err: any) {
      console.error('Error fetching tabs:', err);
      setMessage(`❌ Error fetching tabs: ${err.message}`);
    }
  };
  const [tabs, setTabs] = useState<Array<{ id: string; name: string; description: string; is_visible: boolean; api_name: string | null; }>>([]);
  const [showCreateTab, setShowCreateTab] = useState(false);
  const [newTab, setNewTab] = useState({ name: '', description: '', is_visible: true });
  const [editingTab, setEditingTab] = useState<{ id: string; name: string; description: string; is_visible: boolean } | null>(null);

  // User management state
  const [users, setUsers] = useState<Array<{ id: string; email: string; role: string; profile?: { id: string; name: string } }>>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'user', profile_id: null as string | null });
  const [editingUser, setEditingUser] = useState<{ id: string; email: string; role: string; profile_id: string | null } | null>(null);

  // Profile management handlers
  const handleCreateProfile = async () => {
    if (!newProfile.name.trim()) {
      setMessage('❌ Profile name is required');
      return;
    }
  
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([{ name: newProfile.name, description: newProfile.description }])
        .select();

      if (error) throw error;

      setProfiles([...profiles, data[0]]);
      setShowCreateProfile(false);
      setNewProfile({ name: '', description: '' });
      setMessage('✅ Profile created successfully!');
    } catch (err: any) {
      console.error('Error creating profile:', err);
      setMessage(`❌ Error creating profile: ${err.message}`);
    }
  };

  const handleEditProfile = (profile: { id: string; name: string; description: string }) => {
    setEditingProfile(profile);
    setShowCreateProfile(true);
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;

      setProfiles(profiles.filter(p => p.id !== profileId));
      setMessage('✅ Profile deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting profile:', err);
      setMessage(`❌ Error deleting profile: ${err.message}`);
    }
  };

  // Fetch profiles on component mount
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('name');

        if (error) throw error;
        setProfiles(data || []);
      } catch (err: any) {
        console.error('Error fetching profiles:', err);
        setMessage(`❌ Error fetching profiles: ${err.message}`);
      }
    };

    fetchProfiles();
  }, []);

  useEffect(() => {
    fetchTabs();
  }, []);

  const [newSection, setNewSection] = useState({ name: '' });
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showLayoutSavedDialog, setShowLayoutSavedDialog] = useState(false);

  // Related Lists state
  const [relatedLists, setRelatedLists] = useState<RelatedList[]>([]);
  const [showCreateRelatedList, setShowCreateRelatedList] = useState(false);
  const [showEditRelatedList, setShowEditRelatedList] = useState(false);
  const [newRelatedList, setNewRelatedList] = useState({
    child_table: '',
    foreign_key_field: '',
    label: '',
    display_columns: ['id', 'name'],
    section: 'details'
  });
  const [editingRelatedList, setEditingRelatedList] = useState<RelatedList | null>(null);
  const [creatingRelatedList, setCreatingRelatedList] = useState(false);

  // Object creation
  const [showCreateObject, setShowCreateObject] = useState(false);
  const [newObject, setNewObject] = useState({
    label: '',
    api_name: '',
    create_tab: true,
    auto_number: true
  });
  const [creatingObject, setCreatingObject] = useState(false);
  
  // Field creation
  const [showCreateField, setShowCreateField] = useState(false);
  const [newField, setNewField] = useState<Omit<FieldMetadata, 'id' | 'table_name' | 'is_system_field' | 'is_visible'>>({
    api_name: '',
    display_label: '',
    field_type: 'text',
    is_required: false,
    is_nullable: true, // Default to nullable
    default_value: '',
    validation_rules: [], // Added validation_rules
    display_order: 0, // Added display_order
    section: '', // Changed from 'details' to empty string
    width: 'half',
    reference_table: '',
    reference_display_field: '',
  });
  const [creatingField, setCreatingField] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  
  // Field searching
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  
  // Field pool search for Page Layout
  const [fieldPoolSearchQuery, setFieldPoolSearchQuery] = useState('');
  
  // Field editing
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [editingField, setEditingField] = useState<FieldMetadata | null>(null);
  const [saving, setSaving] = useState(false); // Added missing saving state
  
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
  const [creatingRule, setCreatingRule] = useState(false);
  
  const [message, setMessage] = useState('');

  // Check if user has admin access
  const hasAdminAccess = user?.user?.role === 'admin';

  useEffect(() => {
    if (hasAdminAccess) {
      fetchDatabaseObjects();
    }
  }, [hasAdminAccess]);

  // Reset selected object when navigating to object manager tab
  useEffect(() => {
    if (activeMainTab === 'object_manager') {
      setSelectedObject(null);
      setActiveSection('details');
    }
  }, [activeMainTab]);

  useEffect(() => {
    const searchTerm = objectSearchQuery.toLowerCase();
    if (searchTerm === '') {
      setFilteredObjects(objects);
    } else {
      const filtered = objects.filter(obj =>
        (obj.label && obj.label.toLowerCase().includes(searchTerm)) ||
        obj.table_name.toLowerCase().includes(searchTerm)
      );
      setFilteredObjects(filtered);
    }
  }, [objectSearchQuery, objects]);

  useEffect(() => {
    if (selectedObject) {
      fetchFieldMetadata(selectedObject);
      fetchRelatedLists(selectedObject);
      setActiveSection('details'); // Set active section to details when an object is selected
    }
  }, [selectedObject]);

  const fetchDatabaseObjects = async () => {
    try {
      setLoading(true);
      console.log('Fetching database objects...');

      const { data, error } = await supabase.rpc('get_database_objects');

      if (error) {
        console.error('Error fetching database objects:', error);
        throw error;
      }

      const filteredObjects = (data || []).filter((obj: DatabaseObject) => obj.table_name !== 'object_manager');
      console.log('Fetched objects:', filteredObjects);
      setObjects(filteredObjects);
      setFilteredObjects(filteredObjects);
    } catch (err: any) {
      console.error('Error in fetchDatabaseObjects:', err);
      setMessage(`❌ Error fetching objects: ${err.message}`);
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
        setMessage(`❌ Error syncing metadata for ${tableName}: ${error.message}`);
      } else {
        console.log('✅ Metadata synced:', data);
        setMessage(`✅ Metadata for ${tableName} synced successfully!`);
        // Fetch the metadata again after syncing
        fetchFieldMetadata(tableName);
      }
    } catch (err) {
      console.error('❌ Unexpected error syncing metadata:', err);
      setMessage(`❌ An unexpected error occurred while syncing metadata for ${tableName}.`);
    }
  };

  const generateApiName = (label: string) => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const handleCreateObject = async () => {
    if (!newObject.label.trim()) {
      setMessage('❌ Object label is required');
      return;
    }

    if (!newObject.api_name.trim()) {
      setMessage('❌ API name is required');
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newObject.api_name)) {
      setMessage('❌ API name must start with a letter and contain only letters, numbers, and underscores');
      return;
    }

    setCreatingObject(true);
    setMessage('');

    try {
      console.log('🔧 Starting object creation process:', newObject);

      // Create the table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${newObject.api_name} (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text,
          created_at timestamptz DEFAULT now()
        );
      `.trim();

      console.log('Executing SQL:', createTableSQL);

      const { error: createError } = await supabase.rpc('execute_sql', {
        sql_query: createTableSQL
      });

      if (createError) {
        console.error('Error creating table:', createError);
        throw createError;
      }

      // No need to check for data, as DDL statements like CREATE TABLE don't return rows

      console.log('Table created successfully');

      // Create tab if requested
      const { error: tabError } = await supabase
        .from('tabs')
        .insert([
          {
            name: newObject.label,
            description: `Tab for ${newObject.label} object`,
            is_visible: !!newObject.create_tab, // true if checked, false if not
            api_name: newObject.api_name
          }
        ]);

      if (tabError) {
        console.error('Error creating tab:', tabError);
        // Continue even if tab creation fails
      } else {
        console.log('Tab created successfully');
      }

      // After creating the table, sync its metadata
      console.log('Syncing table metadata');
      await syncTableMetadata(newObject.api_name);

      // Refresh the objects list
      console.log('Refreshing objects list');
      await fetchDatabaseObjects();

      setMessage(`✅ Object '${newObject.label}' created and synced successfully!`);
      setShowCreateObject(false);
      setNewObject({
        label: '',
        api_name: '',
        create_tab: true,
        auto_number: true
      });

      // Set the newly created object as selected
      setSelectedObject(newObject.api_name);
      setActiveSection('details');

    } catch (err: any) {
      console.error('❌ Error creating object:', err);
      setMessage(`❌ Error creating object: ${err.message || 'An unexpected error occurred'}`);
    } finally {
      setCreatingObject(false);
    }
  };

  const handleSaveObjectLabel = async () => {
    if (!selectedObject || !editingObjectLabel.trim()) {
      setMessage('❌ Label cannot be empty.');
      return;
    }
  
    setSaving(true);
    try {
      // Upsert into the new object_metadata table
      const { error } = await supabase
        .from('object_metadata')
        .upsert(
          {
            api_name: selectedObject,
            label: editingObjectLabel,
          },
          {
            onConflict: 'api_name',
          }
        );
  
      if (error) {
        throw error;
      }
      
      // Refresh the data
      await fetchDatabaseObjects(); 
      
      setMessage('✅ Label updated successfully!');
      setIsEditingObject(false);
    } catch (err: any) {
      console.error('Error saving object label:', err);
      setMessage(`❌ Error saving label: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Soft delete object (archive instead of hard delete)
  const handleDeleteObject = async (tableName: string) => {
    if (confirm(`Are you sure you want to archive the object '${tableName}'? This will hide it from the interface but preserve the data. You can restore it later if needed.`)) {
      setLoading(true);
      try {
        // Call the Supabase RPC function to archive the object
        const { error } = await supabase.rpc('archive_object', { 
          table_name_param: tableName 
        });

        if (error) {
          throw error;
        }

        setMessage(`✅ Object '${tableName}' archived successfully!`);
        
        // Update the local state
        setObjects(prev => prev.filter(obj => obj.table_name !== tableName));
        setFilteredObjects(prev => prev.filter(obj => obj.table_name !== tableName));
        
        // Clear selection if the archived object was selected
        if (selectedObject === tableName) {
          setSelectedObject(null);
        }
        
      } catch (err: any) {
        console.error('Error archiving object:', err);
        setMessage(`❌ Error archiving object: ${err.message || 'An unexpected error occurred'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCreateField = async () => {
    if (!selectedObject) {
      setFieldError('❌ Please select an object first.');
      return;
    }
    if (!newField.api_name.trim() || !newField.display_label.trim()) {
      setFieldError('❌ Display Label and API Name are required.');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(newField.api_name)) {
      setFieldError('❌ API Name must start with a letter and contain only lowercase letters, numbers, and underscores.');
      return;
    }

    // Validate reference field requirements
    if (newField.field_type === 'reference') {
      if (!newField.reference_table || newField.reference_table.trim() === '') {
        setFieldError('❌ Please select a reference object for reference fields.');
        return;
      }
    }

    setCreatingField(true);
    setFieldError(null);

    try {
      const { error } = await supabase.rpc('create_field_and_metadata', {
        p_api_name: newField.api_name,
        p_display_label: newField.display_label,
        p_field_type: newField.field_type,
        p_table_name: selectedObject,
        p_is_required: newField.is_required,
        p_is_nullable: newField.is_nullable,
        p_is_system_field: false,
        p_is_visible: true,
        p_section: newField.section,
        p_width: newField.width,
        p_default_value: newField.default_value === '' ? null : newField.default_value,
        p_display_order: newField.display_order,
        p_reference_table: newField.field_type === 'reference' && newField.reference_table !== '' ? newField.reference_table : null,
        p_validation_rules: newField.validation_rules,
      });

      if (error) {
        throw error;
      }

      // Don't show toast for field creation success, just close modal
      setShowCreateField(false);
      resetNewField();
      setFieldError(null);
      fetchFieldMetadata(selectedObject); // Refresh fields for selected object
    } catch (err: any) {
      logError('creating field', err, { fieldData: newField });
      setFieldError(`❌ Error creating field: ${formatErrorMessage(err)}`);
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
      is_nullable: true,
      default_value: '',
      validation_rules: [],
      display_order: 0,
      section: '',
      width: 'half',
      reference_table: '',
      reference_display_field: '',
    });
  };

  // Add missing fetchRelatedLists function
  const fetchRelatedLists = async (tableName: string) => {
    try {
      const { data, error } = await supabase.rpc('get_related_lists', {
        p_parent_table: tableName
      });
      
      if (error) throw error;
      setRelatedLists(data || []);
    } catch (err: any) {
      logError('fetching related lists', err);
    }
  };

  // Add the rest of the component JSX here
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveMainTab('home')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeMainTab === 'home'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏠 Home
            </button>
            <button
              onClick={() => setActiveMainTab('object_manager')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeMainTab === 'object_manager'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📦 Object Manager
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Home Tab Content */}
        {activeMainTab === 'home' && (
          <div className="flex gap-6">
            {/* Sidebar with sections */}
            <div className="w-64 bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">System Settings</h2>
              </div>
              <div className="p-2">
                <nav className="space-y-1">
                  {homeSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setSelectedHomeSection(section.id as any)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedHomeSection === section.id
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{section.icon}</span>
                        <span className="font-medium">{section.label}</span>
                      </div>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex-1 bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {homeSections.find(s => s.id === selectedHomeSection)?.label}
                </h3>
              </div>
              <div className="p-6">
                {selectedHomeSection === 'profile' && (
                  <ProfileManager />
                )}
                {selectedHomeSection === 'users_roles' && (
                  <UserCreator />
                )}
                {selectedHomeSection === 'tab_settings' && (
                  <TabSettingsPage />
                )}
                {selectedHomeSection === 'permission_sets' && (
                  <div className="text-center py-8 text-gray-500">
                    Permission Sets management coming soon...
                  </div>
                )}
                {selectedHomeSection === 'system_settings' && (
                  <div className="text-center py-8 text-gray-500">
                    System Settings management coming soon...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Object Manager Tab Content */}
        {activeMainTab === 'object_manager' && (
          <div className="space-y-6">
            {/* Object Manager Header */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <h2 className="text-lg font-medium text-gray-900">
                    {selectedObject ? objects.find(obj => obj.table_name === selectedObject)?.label || selectedObject : ''}
                  </h2>
                </div>
                {selectedObject && (
                  <button
                    onClick={() => {
                      setSelectedObject(null);
                      setActiveSection('details');
                    }}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Objects
                  </button>
                )}
              </div>
            </div>

            {/* Content Area */}
            {!selectedObject ? (
              /* Object List View - Main Content */
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="relative w-64">
                      <input
                        type="text"
                        placeholder="Search objects..."
                        value={objectSearchQuery}
                        onChange={(e) => setObjectSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCreateObject(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      + New Object
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-500">Loading objects...</p>
                    </div>
                  ) : filteredObjects.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-4">
                        <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No objects found</h3>
                      <p className="text-gray-500 mb-4">
                        {objectSearchQuery ? 'Try adjusting your search terms.' : 'Get started by creating your first object.'}
                      </p>
                      {!objectSearchQuery && (
                        <button
                          onClick={() => setShowCreateObject(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          + Create First Object
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredObjects.map((obj) => (
                        <div
                          key={obj.table_name}
                          onClick={() => {
                            setSelectedObject(obj.table_name);
                            setActiveSection('details');
                          }}
                          className="p-4 border border-gray-200 rounded-lg cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-blue-600 font-medium text-sm">
                                      {obj.label.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-lg font-medium text-gray-900 truncate">{obj.label}</h4>
                                  <p className="text-sm text-gray-500 truncate">{obj.table_name}</p>
                                  <div className="flex items-center space-x-2 text-xs text-gray-400 mt-1">
                                    <span>{obj.table_schema}</span>
                                    <span>•</span>
                                    <span>{obj.table_type}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteObject(obj.table_name);
                                }}
                                className="text-red-600 hover:text-red-800 p-2 rounded-md hover:bg-red-50 transition-colors"
                                title="Delete object"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <div className="text-gray-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Two Panel Layout: Sections | Content */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel 1: Object Sections */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      {/* Removed edit (pencil) icon and object name here to avoid repetition */}
                    </div>
                    <div className="p-2">
                      <nav className="space-y-1">
                        {objectManagerSections.map((section) => (
                          <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id as any)}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                              activeSection === section.id
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-lg">{section.icon}</span>
                              <span className="font-medium">{section.label}</span>
                            </div>
                          </button>
                        ))}
                      </nav>
                    </div>
                  </div>
                </div>

                {/* Panel 2: Content Area */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        {/* Removed section headline from content area */}
                        {/* Remove + New Field button from here, move to fields tab search row */}
                      </div>
                    </div>

                    {/* Section Content */}
                    <div className="p-6">
                      {activeSection === 'details' && (
                        <div className="space-y-6">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900 mb-4">Object Information</h4>
                            <div className="bg-gray-50 rounded-lg p-4">
                              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                                <div>
                                  <dt className="text-sm font-medium text-gray-500">Object Label</dt>
                                  <dd className="mt-1 text-sm text-gray-900">
                                    {objects.find(obj => obj.table_name === selectedObject)?.label || 'N/A'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-sm font-medium text-gray-500">API Name</dt>
                                  <dd className="mt-1 text-sm text-gray-900">{selectedObject}</dd>
                                </div>
                                <div>
                                  <dt className="text-sm font-medium text-gray-500">Table Schema</dt>
                                  <dd className="mt-1 text-sm text-gray-900">
                                    {objects.find(obj => obj.table_name === selectedObject)?.table_schema || 'public'}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-sm font-medium text-gray-500">Table Type</dt>
                                  <dd className="mt-1 text-sm text-gray-900">
                                    {objects.find(obj => obj.table_name === selectedObject)?.table_type || 'BASE TABLE'}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h4>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                              <div className="bg-blue-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-blue-600">{fieldMetadata.length}</div>
                                <div className="text-sm text-blue-700">Total Fields</div>
                              </div>
                              <div className="bg-green-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-green-600">
                                  {fieldMetadata.filter(f => f.is_visible).length}
                                </div>
                                <div className="text-sm text-green-700">Visible Fields</div>
                              </div>
                              <div className="bg-purple-50 rounded-lg p-4">
                                <div className="text-2xl font-bold text-purple-600">{relatedLists.length}</div>
                                <div className="text-sm text-purple-700">Related Lists</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {activeSection === 'fields' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                placeholder="Search fields..."
                                value={fieldSearchQuery}
                                onChange={(e) => setFieldSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                              />
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowCreateField(true)}
                              className="ml-2 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              + New Field
                            </button>
                          </div>
                          <div className="space-y-2">
                            {fieldMetadata
                              .filter(field => 
                                fieldSearchQuery === '' || 
                                field.display_label.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
                                field.api_name.toLowerCase().includes(fieldSearchQuery.toLowerCase())
                              )
                              .map((field) => (
                                <div key={field.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <span className="text-lg">
                                      {field.reference_table ? '🔗' : 
                                        field.field_type === 'text' ? '📝' :
                                        field.field_type === 'integer' ? '🔢' :
                                        field.field_type === 'boolean' ? '✅' :
                                        field.field_type === 'date' ? '📅' :
                                        field.field_type === 'timestamptz' ? '⏰' :
                                        field.field_type === 'uuid' ? '🆔' :
                                        field.field_type === 'jsonb' ? '📄' : '📝'
                                      }
                                    </span>
                                    <div>
                                      <div className="font-medium text-gray-900">{field.display_label}</div>
                                      <div className="text-sm text-gray-500">{field.api_name}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {field.is_required && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Required
                                      </span>
                                    )}
                                    {field.is_system_field && (
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        System
                                      </span>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingField(field);
                                        setShowEditFieldModal(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      {activeSection === 'layout' && (
                        <ObjectLayoutEditor
                          selectedObject={selectedObject}
                          fieldMetadata={fieldMetadata}
                          relatedLists={relatedLists}
                          onLayoutChange={() => fetchFieldMetadata(selectedObject)}
                          getFieldIcon={(dataType: string, isReference?: boolean) => {
                            if (isReference) return '🔗';
                            switch (dataType) {
                              case 'text': return '📝';
                              case 'integer': return '🔢';
                              case 'boolean': return '✅';
                              case 'date': return '📅';
                              case 'timestamptz': return '⏰';
                              case 'uuid': return '🆔';
                              case 'jsonb': return '📄';
                              default: return '📝';
                            }
                          }}
                          handleEditField={(field) => {
                            setEditingField(field);
                            setShowEditFieldModal(true);
                          }}
                          isSystemField={(apiName) => {
                            return fieldMetadata.find(f => f.api_name === apiName)?.is_system_field || false;
                          }}
                          onEditRelatedList={(relatedList) => {
                            setEditingRelatedList(relatedList);
                            setShowEditRelatedList(true);
                          }}
                          onDeleteRelatedList={(relatedListId, label) => {
                            if (confirm(`Are you sure you want to delete the related list "${label}"?`)) {
                              // Handle delete related list
                            }
                          }}
                          onAddRelatedList={() => {
                            setShowCreateRelatedList(true);
                          }}
                        />
                      )}
                      
                      {activeSection === 'validation' && (
                        <div className="text-center py-8 text-gray-500">
                          Validation Rules management coming soon...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Object Modal */}
      {showCreateObject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Object</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Object Label</label>
                  <input
                    type="text"
                    value={newObject.label}
                    onChange={(e) => setNewObject({ ...newObject, label: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Customer, Product"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">API Name</label>
                  <input
                    type="text"
                    value={newObject.api_name}
                    onChange={(e) => setNewObject({ ...newObject, api_name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., customer, product"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newObject.create_tab}
                    onChange={(e) => setNewObject({ ...newObject, create_tab: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">Create navigation tab</label>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateObject(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateObject}
                  disabled={creatingObject}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {creatingObject ? 'Creating...' : 'Create Object'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Field Modal */}
      {showCreateField && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Create New Field
              </h3>
              
              {/* Error Message Display */}
              {(message && message.includes('❌')) || fieldError ? (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">
                        {fieldError || (message && message.includes('❌') ? message : 'An error occurred')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="display-label" className="block text-sm font-medium text-gray-700">Display Label</label>
                  <input
                    type="text"
                    id="display-label"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={newField.display_label}
                    onChange={(e) => setNewField({ ...newField, display_label: e.target.value })}
                    placeholder="e.g., Customer Name"
                  />
                </div>

                <div>
                  <label htmlFor="api-name" className="block text-sm font-medium text-gray-700">API Name</label>
                  <input
                    type="text"
                    id="api-name"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={newField.api_name}
                    onChange={(e) => setNewField({ ...newField, api_name: e.target.value })}
                    placeholder="e.g., customer_name"
                  />
                </div>

                <div>
                  <label htmlFor="field-type" className="block text-sm font-medium text-gray-700">Field Type</label>
                  <select
                    id="field-type"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={newField.field_type}
                    onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
                  >
                    {dataTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reference Object Selection - Only show when field type is 'reference' */}
                {newField.field_type === 'reference' && (
                  <div>
                    <label htmlFor="reference-table" className="block text-sm font-medium text-gray-700">Reference Object</label>
                    <select
                      id="reference-table"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={newField.reference_table || ''}
                      onChange={(e) => setNewField({ ...newField, reference_table: e.target.value })}
                    >
                      <option value="">Select an object</option>
                      {objects.map((obj) => (
                        <option key={obj.table_name} value={obj.table_name}>
                          {obj.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is-required"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={newField.is_required}
                    onChange={(e) => setNewField({ ...newField, is_required: e.target.checked, is_nullable: !e.target.checked })}
                  />
                  <label htmlFor="is-required" className="ml-2 block text-sm text-gray-900">
                    Required field
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateField(false);
                    resetNewField();
                    setMessage('');
                    setFieldError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateField}
                  disabled={creatingField}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {creatingField ? 'Creating...' : 'Create Field'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Object Label Modal */}
      {isEditingObject && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Object Label</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700">Object Label</label>
                <input
                  type="text"
                  value={editingObjectLabel}
                  onChange={(e) => setEditingObjectLabel(e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsEditingObject(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveObjectLabel}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Field Modal */}
      {showEditFieldModal && editingField && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Edit Field: {editingField.display_label}
              </h3>
              
              {/* Error Message Display */}
              {fieldError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{fieldError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="edit-display-label" className="block text-sm font-medium text-gray-700">Display Label</label>
                  <input
                    type="text"
                    id="edit-display-label"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={editingField.display_label}
                    onChange={(e) => setEditingField({ ...editingField, display_label: e.target.value })}
                    placeholder="e.g., Customer Name"
                  />
                </div>

                <div>
                  <label htmlFor="edit-api-name" className="block text-sm font-medium text-gray-700">API Name</label>
                  <input
                    type="text"
                    id="edit-api-name"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={editingField.api_name}
                    onChange={(e) => setEditingField({ ...editingField, api_name: e.target.value })}
                    placeholder="e.g., customer_name"
                    disabled={editingField.is_system_field}
                  />
                  {editingField.is_system_field && (
                    <p className="mt-1 text-sm text-gray-500">System fields cannot be renamed</p>
                  )}
                </div>

                <div>
                  <label htmlFor="edit-field-type" className="block text-sm font-medium text-gray-700">Field Type</label>
                  <select
                    id="edit-field-type"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={editingField.field_type}
                    onChange={(e) => setEditingField({ ...editingField, field_type: e.target.value })}
                    disabled={editingField.is_system_field}
                  >
                    {dataTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {editingField.is_system_field && (
                    <p className="mt-1 text-sm text-gray-500">System field types cannot be changed</p>
                  )}
                </div>

                {/* Reference Object Selection - Only show when field type is 'reference' */}
                {editingField.field_type === 'reference' && (
                  <div>
                    <label htmlFor="edit-reference-table" className="block text-sm font-medium text-gray-700">Reference Object</label>
                    <select
                      id="edit-reference-table"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      value={editingField.reference_table || ''}
                      onChange={(e) => setEditingField({ ...editingField, reference_table: e.target.value })}
                    >
                      <option value="">Select an object</option>
                      {objects.map((obj) => (
                        <option key={obj.table_name} value={obj.table_name}>
                          {obj.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-is-required"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={editingField.is_required}
                    onChange={(e) => setEditingField({ ...editingField, is_required: e.target.checked, is_nullable: !e.target.checked })}
                  />
                  <label htmlFor="edit-is-required" className="ml-2 block text-sm text-gray-900">
                    Required field
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-is-visible"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={editingField.is_visible}
                    onChange={(e) => setEditingField({ ...editingField, is_visible: e.target.checked })}
                  />
                  <label htmlFor="edit-is-visible" className="ml-2 block text-sm text-gray-900">
                    Visible in interface
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditFieldModal(false);
                    setEditingField(null);
                    setFieldError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      setSaving(true);
                      setFieldError(null);
                      
                      const { error } = await supabase
                        .from('field_metadata')
                        .update({
                          display_label: editingField.display_label,
                          api_name: editingField.api_name,
                          field_type: editingField.field_type,
                          is_required: editingField.is_required,
                          is_nullable: !editingField.is_required,
                          is_visible: editingField.is_visible,
                          reference_table: editingField.field_type === 'reference' ? editingField.reference_table : null,
                        })
                        .eq('id', editingField.id);

                      if (error) throw error;

                      setMessage('✅ Field updated successfully!');
                      setShowEditFieldModal(false);
                      setEditingField(null);
                      fetchFieldMetadata(selectedObject!);
                    } catch (err: any) {
                      logError('updating field', err, { fieldData: editingField });
                      setFieldError(`❌ Error updating field: ${formatErrorMessage(err)}`);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Message */}
      {message && (
        <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 max-w-md ${message.includes('❌') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {message.includes('❌') ? (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setMessage('')}
                className="inline-flex text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
