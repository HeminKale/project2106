'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from './AuthProvider';
import UserCreator from './UserCreator';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import FieldDragItem from './FieldDragItem';
import ObjectLayoutEditor from './ObjectLayoutEditor';
import { ToastProvider } from './Toast';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const [activeSection, setActiveSection] = useState<'fields' | 'layout' | 'validation' | 'details' | 'related_lists'>('details');
  
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
      if (newObject.create_tab) {
        console.log('Creating navigation tab');
        const { error: tabError } = await supabase
          .from('tabs')
          .insert([{
            name: newObject.label,
            description: `Tab for ${newObject.label} object`,
            is_visible: true,
            api_name: newObject.api_name
          }]);

        if (tabError) {
          console.error('Error creating tab:', tabError);
          // Continue even if tab creation fails
        } else {
          console.log('Tab created successfully');
        }
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
      setMessage('❌ Please select an object first.');
      return;
    }
    if (!newField.api_name.trim() || !newField.display_label.trim()) {
      setMessage('❌ Display Label and API Name are required.');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(newField.api_name)) {
      setMessage('❌ API Name must start with a letter and contain only lowercase letters, numbers, and underscores.');
      return;
    }

    setCreatingField(true);
    setMessage('');

    try {
      const { error } = await supabase.rpc('create_field_and_metadata', {
        p_api_name: newField.api_name,
        p_default_value: newField.default_value === '' ? null : newField.default_value,
        p_display_label: newField.display_label,
        p_display_order: newField.display_order,
        p_field_type: newField.field_type,
        p_is_nullable: newField.is_nullable,
        p_is_required: newField.is_required,
        p_is_system_field: false,
        p_is_visible: true,
        p_reference_display_field: newField.field_type === 'reference' && newField.reference_display_field !== '' ? newField.reference_display_field : null,
        p_reference_table: newField.field_type === 'reference' && newField.reference_table !== '' ? newField.reference_table : null,
        p_section: newField.section,
        p_table_name: selectedObject,
        p_validation_rules: newField.validation_rules,
        p_width: newField.width,
      });

      if (error) {
        throw error;
      }

      setMessage(`✅ Field '${newField.display_label}' created successfully!`);
      setShowCreateField(false);
      resetNewField();
      fetchFieldMetadata(selectedObject); // Refresh fields for selected object
    } catch (err: any) {
      console.error('❌ Error creating field:', err);
      setMessage(`❌ Error creating field: ${err.message || 'An unexpected error occurred'}`);
    } finally {
      setCreatingField(false);
    }
  };

  const handleUpdateField = async () => {
    if (!editingField) return;

    setSaving(true); // Using 'saving' state for field edits as well
    setMessage('');

    try {
      const { error } = await supabase.rpc('update_field_metadata', {
        default_value_param: editingField.default_value === '' ? null : editingField.default_value,
        display_label_param: editingField.display_label,
        field_id_param: editingField.id,
        field_type_param: editingField.field_type,
        is_nullable_param: !editingField.is_required,
        is_required_param: editingField.is_required,
        is_system_field_param: editingField.is_system_field,
        is_visible_param: editingField.is_visible,
        reference_display_field_param: editingField.field_type === 'reference' && editingField.reference_display_field !== '' ? editingField.reference_display_field : null,
        reference_table_param: editingField.field_type === 'reference' && editingField.reference_table !== '' ? editingField.reference_table : null,
        section_param: editingField.section,
        width_param: editingField.width,
      });

      if (error) {
        throw error;
      }

      setMessage(`✅ Field '${editingField.display_label}' updated successfully!`);
      setShowEditFieldModal(false);
      setEditingField(null);
      fetchFieldMetadata(selectedObject!); // Refresh fields
    } catch (err: any) {
      console.error('❌ Error updating field:', err);
      setMessage(`❌ Error updating field: ${err.message || 'An unexpected error occurred'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string, apiName: string) => {
    if (!selectedObject) return;
    if (confirm(`Are you sure you want to delete the field '${apiName}'? This action cannot be undone.`)) {
      setSaving(true);
      setMessage('');
      try {
        const { error } = await supabase.rpc('delete_field_and_column', {
          table_name_param: selectedObject,
          field_id_param: fieldId,
          api_name_param: apiName,
        });

        if (error) {
          throw error;
        }

        setMessage(`✅ Field '${apiName}' deleted successfully!`);
        fetchFieldMetadata(selectedObject); // Refresh fields
      } catch (err: any) {
        console.error('❌ Error deleting field:', err);
        setMessage(`❌ Error deleting field: ${err.message || 'An unexpected error occurred'}`);
      } finally {
        setSaving(false);
      }
    }
  };

  const resetNewField = () => {
    setNewField({
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
  };

  const handleEditField = (field: FieldMetadata) => {
    setEditingField(field);
    setShowEditFieldModal(true);
  };

  const getObjectIcon = (objectName: string) => {
    switch (objectName) {
      case 'clients': return '👤';
      case 'channel_partners': return '🤝';
      case 'billing': return '💰';
      case 'users': return '👥';
      default: return '📦';
    }
  };

  const isSystemObject = (objectName: string) => {
    const systemObjects = ['clients', 'channel_partners', 'billing', 'users', 'field_metadata', 'roles', 'permissions', 'profiles'];
    return systemObjects.includes(objectName);
  };

  const handleUpdateFieldProperty = (fieldId: string, property: keyof FieldMetadata, value: any) => {
    setFieldMetadata(prev => prev.map(field => 
      field.id === fieldId ? { ...field, [property]: value } : field
    ));
  };

  const getFieldIcon = (dataType: string, isReference: boolean = false) => {
    if (isReference) return '🔗';
    switch (dataType) {
      case 'text': return '📄';
      case 'varchar': return '📝';
      case 'integer': return '🔢';
      case 'decimal': return '💰';
      case 'boolean': return '✔️';
      case 'date': return '📅';
      case 'timestamptz': return '⏰';
      case 'uuid': return '🆔';
      case 'jsonb': return '{} ';
      default: return '❓';
    }
  };

  const handleCreateValidationRule = async () => {
    if (!selectedObject) {
      setMessage('❌ Please select an object first.');
      return;
    }
    if (!newRule.field || !newRule.type || !newRule.message) {
      setMessage('❌ Field, Rule Type, and Error Message are required.');
      return;
    }

    setCreatingRule(true);
    setMessage('');

    try {
      // This is a client-side only array for now. In a real app, this would be stored in DB.
      // For demonstration, we'll just add it to the state.
      setValidationRules(prev => [...prev, { ...newRule, id: Date.now().toString() }]);
      setMessage(`✅ Validation rule for '${newRule.field}' created successfully!`);
      setShowCreateRule(false);
      setNewRule({ field: '', type: 'required', value: '', message: '', enabled: true });
    } catch (err: any) {
      console.error('❌ Error creating validation rule:', err);
      setMessage(`❌ Error creating validation rule: ${err.message || 'An unexpected error occurred'}`);
    } finally {
      setCreatingRule(false);
    }
  };

  const filteredFields = fieldMetadata.filter(field =>
    field.display_label.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
    field.api_name.toLowerCase().includes(fieldSearchQuery.toLowerCase())
  );

  // Tab management handlers
  const handleCreateTab = async () => {
    if (!newTab.name.trim()) {
      setMessage('❌ Tab name is required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tabs')
        .insert([{ name: newTab.name, description: newTab.description, is_visible: newTab.is_visible }])
        .select();

      if (error) throw error;

      setTabs([...tabs, data[0]]);
      setShowCreateTab(false);
      setNewTab({ name: '', description: '', is_visible: true });
      setMessage('✅ Tab created successfully!');
    } catch (err: any) {
      console.error('Error creating tab:', err);
      setMessage(`❌ Error creating tab: ${err.message}`);
    }
  };

  const handleEditTab = (tab: { id: string; name: string; description: string; is_visible: boolean }) => {
    setEditingTab(tab);
    setNewTab({ name: tab.name, description: tab.description, is_visible: tab.is_visible });
    setShowCreateTab(true);
  };

  const handleUpdateTab = async () => {
    if (!editingTab || !newTab.name.trim()) {
      setMessage('❌ Tab name is required');
      return;
    }

    try {
      const { error } = await supabase
        .from('tabs')
        .update({
          name: newTab.name,
          description: newTab.description,
          is_visible: newTab.is_visible
        })
        .eq('id', editingTab.id);

      if (error) throw error;

      setTabs(tabs.map(t => t.id === editingTab.id ? { ...t, ...newTab } : t));
      setShowCreateTab(false);
      setEditingTab(null);
      setNewTab({ name: '', description: '', is_visible: true });
      setMessage('✅ Tab updated successfully!');
    } catch (err: any) {
      console.error('Error updating tab:', err);
      setMessage(`❌ Error updating tab: ${err.message}`);
    }
  };

  const handleToggleTabVisibility = async (tabId: string, isVisible: boolean) => {
    try {
      const { error } = await supabase
        .from('tabs')
        .update({ is_visible: isVisible })
        .eq('id', tabId);

      if (error) throw error;

      setTabs(tabs.map(t => t.id === tabId ? { ...t, is_visible: isVisible } : t));
      setMessage(`✅ Tab ${isVisible ? 'shown' : 'hidden'} successfully!`);
    } catch (err: any) {
      console.error('Error toggling tab visibility:', err);
      setMessage(`❌ Error toggling tab visibility: ${err.message}`);
    }
  };

  const handleDeleteTab = async (tabId: string) => {
    if (!confirm('Are you sure you want to delete this tab?')) return;

    try {
      const { error } = await supabase
        .from('tabs')
        .delete()
        .eq('id', tabId);

      if (error) throw error;

      setTabs(tabs.filter(t => t.id !== tabId));
      setMessage('✅ Tab deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting tab:', err);
      setMessage(`❌ Error deleting tab: ${err.message}`);
    }
  };

  // Fetch tabs on component mount
  useEffect(() => {
    fetchTabs();
  }, []);

  // User management handlers
  const handleCreateUser = async () => {
    if (!newUser.email.trim()) {
      setMessage('❌ Email is required');
      return;
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: 'password123', // Default password
        email_confirm: true,
        user_metadata: {
          role: newUser.role,
          profile_id: newUser.profile_id
        }
      });

      if (error) throw error;

      // Add the new user to the list with profile information
      const profile = profiles.find(p => p.id === newUser.profile_id);
      setUsers([...users, {
        id: data.user.id,
        email: data.user.email!,
        role: newUser.role,
        profile: profile ? { id: profile.id, name: profile.name } : undefined
      }]);

      setShowCreateUser(false);
      setNewUser({ email: '', role: 'user', profile_id: null });
      setMessage('✅ User created successfully!');
    } catch (err: any) {
      console.error('Error creating user:', err);
      setMessage(`❌ Error creating user: ${err.message}`);
    }
  };

  const handleEditUser = (user: { id: string; email: string; role: string; profile?: { id: string; name: string } }) => {
    setEditingUser({
      id: user.id,
      email: user.email,
      role: user.role,
      profile_id: user.profile?.id || null
    });
    setNewUser({
      email: user.email,
      role: user.role,
      profile_id: user.profile?.id || null
    });
    setShowCreateUser(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !newUser.email.trim()) {
      setMessage('❌ Email is required');
      return;
    }

    try {
      const { error } = await supabase.auth.admin.updateUserById(
        editingUser.id,
        {
          email: newUser.email,
          user_metadata: {
            role: newUser.role,
            profile_id: newUser.profile_id
          }
        }
      );

      if (error) throw error;

      // Update the user in the list with profile information
      const profile = profiles.find(p => p.id === newUser.profile_id);
      setUsers(users.map(u => u.id === editingUser.id ? {
        ...u,
        email: newUser.email,
        role: newUser.role,
        profile: profile ? { id: profile.id, name: profile.name } : undefined
      } : u));

      setShowCreateUser(false);
      setEditingUser(null);
      setNewUser({ email: '', role: 'user', profile_id: null });
      setMessage('✅ User updated successfully!');
    } catch (err: any) {
      console.error('Error updating user:', err);
      setMessage(`❌ Error updating user: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      setUsers(users.filter(u => u.id !== userId));
      setMessage('✅ User deleted successfully!');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setMessage(`❌ Error deleting user: ${err.message}`);
    }
  };

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, role');

        if (usersError) throw usersError;

        // Transform the data to include profile information
        const transformedUsers = usersData.map(user => ({
          id: user.id,
          email: user.email,
          role: user.role || 'user',
          profile: undefined // Profile will be added later when the profile_id column is available
        }));

        setUsers(transformedUsers);
      } catch (err: any) {
        console.error('Error fetching users:', err);
        setMessage(`❌ Error fetching users: ${err.message}`);
      }
    };

    fetchUsers();
  }, [profiles]); // Re-fetch when profiles change

  const fetchRelatedLists = async (tableName: string) => {
    try {
      console.log('🔗 Fetching related lists for table:', tableName);
      
      const { data, error } = await supabase.rpc('get_related_lists', { 
        p_parent_table: tableName 
      });
      
      if (error) {
        console.error('❌ Error fetching related lists:', error);
        setRelatedLists([]);
      } else {
        console.log('✅ Fetched related lists:', data);
        if (data && data.length > 0) {
          setRelatedLists(data);
        } else {
          // If no configured lists, fetch suggestions
          const { data: suggestedData, error: suggestedError } = await supabase.rpc('suggest_related_lists', {
            p_parent: tableName
          });

          if (suggestedError) {
            console.error('❌ Error fetching suggested related lists:', suggestedError);
            setRelatedLists([]);
          } else {
            console.log('✅ Fetched suggested related lists:', suggestedData);
            setRelatedLists(suggestedData || []);
          }
        }
      }
    } catch (err) {
      console.error('❌ Unexpected error fetching related lists:', err);
      setRelatedLists([]);
    }
  };

  const handleCreateRelatedList = async () => {
    if (!selectedObject) {
      setMessage('❌ Please select an object first.');
      return;
    }
    if (!newRelatedList.child_table || !newRelatedList.foreign_key_field || !newRelatedList.label) {
      setMessage('❌ Child Object, Foreign Key Field, and Label are required.');
      return;
    }

    setCreatingRelatedList(true);
    setMessage('');

    try {
      const { data, error } = await supabase.rpc('create_related_list', {
        p_parent_table: selectedObject,
        p_child_table: newRelatedList.child_table,
        p_foreign_key_field: newRelatedList.foreign_key_field,
        p_label: newRelatedList.label,
        p_display_columns: newRelatedList.display_columns,
        p_section: newRelatedList.section,
        p_display_order: relatedLists.length // Add to end of list
      });

      if (error) {
        throw error;
      }

      setMessage(`✅ Related list '${newRelatedList.label}' created successfully!`);
      setShowCreateRelatedList(false);
      setNewRelatedList({
        child_table: '',
        foreign_key_field: '',
        label: '',
        display_columns: ['id', 'name'],
        section: 'details'
      });
      fetchRelatedLists(selectedObject); // Refresh the list
    } catch (err: any) {
      console.error('❌ Error creating related list:', err);
      setMessage(`❌ Error creating related list: ${err.message || 'An unexpected error occurred'}`);
    } finally {
      setCreatingRelatedList(false);
    }
  };

  const handleUpdateRelatedList = async () => {
    if (!editingRelatedList) return;

    setSaving(true);
    setMessage('');

    try {
      const { data, error } = await supabase.rpc('update_related_list', {
        p_id: editingRelatedList.id,
        p_label: editingRelatedList.label,
        p_display_columns: editingRelatedList.display_columns,
        p_section: editingRelatedList.section,
        p_display_order: editingRelatedList.display_order,
        p_is_visible: editingRelatedList.is_visible
      });

      if (error) {
        throw error;
      }

      setMessage(`✅ Related list '${editingRelatedList.label}' updated successfully!`);
      setShowEditRelatedList(false);
      setEditingRelatedList(null);
      fetchRelatedLists(selectedObject!); // Refresh the list
    } catch (err: any) {
      console.error('❌ Error updating related list:', err);
      setMessage(`❌ Error updating related list: ${err.message || 'An unexpected error occurred'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRelatedList = async (relatedListId: string, label: string) => {
    if (!selectedObject) return;
    if (confirm(`Are you sure you want to delete the related list '${label}'? This action cannot be undone.`)) {
      setSaving(true);
      setMessage('');
      try {
        const { error } = await supabase.rpc('delete_related_list', {
          p_id: relatedListId
        });

        if (error) {
          throw error;
        }

        setMessage(`✅ Related list '${label}' deleted successfully!`);
        fetchRelatedLists(selectedObject); // Refresh the list
      } catch (err: any) {
        console.error('❌ Error deleting related list:', err);
        setMessage(`❌ Error deleting related list: ${err.message || 'An unexpected error occurred'}`);
      } finally {
        setSaving(false);
      }
    }
  };

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-xl text-gray-700">Access Denied. Only administrators can access settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Removed the main Settings heading as it is redundant */}

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          {/* Main Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {mainSettingsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveMainTab(tab.id)}
                  className={`
                    ${activeMainTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Home Tab Content */}
            {activeMainTab === 'home' && (
              <div className="flex flex-col md:flex-row gap-6">
                {/* Left Sidebar for Home Sections */}
                <div className="md:w-1/4 bg-gray-50 p-4 rounded-lg shadow-sm">
                  {/* Removed the Home Sections heading as it is redundant */}
                  <nav className="space-y-2">
                    {homeSections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setSelectedHomeSection(section.id as any)}
                        className={`
                          ${selectedHomeSection === section.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                          } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left
                        `}
                      >
                        <span className="ml-3">{section.label}</span>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Main Content for Home Sections */}
                <div className="md:w-3/4">
                  {selectedHomeSection === 'profile' && (
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Profile Settings</h2>
                        <button
                          onClick={() => setShowCreateProfile(true)}
                          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Create New Profile
                        </button>
                      </div>
                      <div className="space-y-4">
                        {/* Profile List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {profiles.map((profile) => (
                            <div key={profile.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-medium text-gray-900">{profile.name}</h3>
                                  <p className="text-sm text-gray-500">{profile.description}</p>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditProfile(profile)}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProfile(profile.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Create Profile Modal */}
                      {showCreateProfile && (
                        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                          <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                      Create New Profile
                                    </h3>
                                    <div className="mt-2 space-y-4">
                                      <div>
                                        <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700">Profile Name</label>
                                        <input
                                          type="text"
                                          id="profile-name"
                                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                          value={newProfile.name}
                                          onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label htmlFor="profile-description" className="block text-sm font-medium text-gray-700">Description</label>
                                        <textarea
                                          id="profile-description"
                                          rows={3}
                                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                          value={newProfile.description}
                                          onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                  <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={handleCreateProfile}
                                  >
                                    Create Profile
                                  </button>
                                  <button
                                    type="button"
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => setShowCreateProfile(false)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedHomeSection === 'users_roles' && (
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Users & Roles</h2>
                        <button
                          onClick={() => setShowCreateUser(true)}
                          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Create New User
                        </button>
                      </div>
                      <div className="space-y-4">
                        {/* User List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {users.map((user) => (
                            <div key={user.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="font-medium text-gray-900">{user.email}</h3>
                                  <p className="text-sm text-gray-500">Role: {user.role}</p>
                                  <p className="text-sm text-gray-500">Profile: {user.profile?.name || 'None'}</p>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditUser(user)}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Create Tab Modal */}
                      {showCreateTab && (
                        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                          <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
                            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                      {editingTab ? 'Edit Tab' : 'Create New Tab'}
                                    </h3>
                                    <div className="mt-2 space-y-4">
                                      <div>
                                        <label htmlFor="tab-name" className="block text-sm font-medium text-gray-700">Tab Name</label>
                                        <input
                                          type="text"
                                          id="tab-name"
                                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                          value={newTab.name}
                                          onChange={(e) => setNewTab({ ...newTab, name: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label htmlFor="tab-description" className="block text-sm font-medium text-gray-700">Description</label>
                                        <textarea
                                          id="tab-description"
                                          rows={3}
                                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                          value={newTab.description}
                                          onChange={(e) => setNewTab({ ...newTab, description: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label className="flex items-center">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            checked={newTab.is_visible}
                                            onChange={(e) => setNewTab({ ...newTab, is_visible: e.target.checked })}
                                          />
                                          <span className="ml-2 text-sm text-gray-700">Visible by default</span>
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                  <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={editingTab ? handleUpdateTab : handleCreateTab}
                                  >
                                    {editingTab ? 'Update Tab' : 'Create Tab'}
                                  </button>
                                  <button
                                    type="button"
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => {
                                      setShowCreateTab(false);
                                      setEditingTab(null);
                                      setNewTab({ name: '', description: '', is_visible: true });
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedHomeSection === 'system_settings' && (
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">System Settings</h2>
                      <p>Access various system-wide configurations.</p>
                      {/* Add actual system settings component here */}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Object Manager Tab Content */}
            {activeMainTab === 'object_manager' && (
              <div className="flex flex-col md:flex-row gap-6">
                {selectedObject && (
                  <div className="md:w-1/4 bg-gray-50 p-4 rounded-lg shadow-sm">
                    <nav className="space-y-2">
                      {/* Removed the 'Object Details' button as it is redundant and the content is directly displayed when no object is selected. */}
                      {/* The 'Object Manager' heading/tab is also removed from here as it's handled by the main tab navigation. */}
                      <>
                        <button
                          onClick={() => setActiveSection('details')}
                          className={`
                            ${activeSection === 'details'
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                            } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left
                          `}
                        >
                          <span className="mr-3">📄</span> Details
                        </button>
                        <button
                          onClick={() => setActiveSection('fields')}
                          className={`
                            ${activeSection === 'fields'
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                            } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left
                          `}
                        >
                          <span className="mr-3">➕</span> Fields
                        </button>
                        <button
                          onClick={() => setActiveSection('layout')}
                          className={`
                            ${activeSection === 'layout'
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                            } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left
                          `}
                        >
                          <span className="mr-3">📝</span> Page Layout
                        </button>
                        <button
                          onClick={() => setActiveSection('validation')}
                          className={`
                            ${activeSection === 'validation'
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                            } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left
                          `}
                        >
                          <span className="mr-3">✅</span> Validation Rules
                        </button>
                        <button
                          onClick={() => setActiveSection('related_lists')}
                          className={`
                            ${activeSection === 'related_lists'
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                            } group flex items-center px-3 py-2 text-sm font-medium rounded-md w-full text-left
                          `}
                        >
                          <span className="mr-3">🔗</span> Related Lists
                        </button>
                      </>
                    </nav>
                  </div>
                )}

                {/* Main Content for Object Manager Sections */}
                <div className={`md:w-${selectedObject ? '3/4' : 'full'}`}>
                  {!selectedObject ? (
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      {/* Removed the 'Select an Object' heading as it is redundant */}
                      <div className="flex justify-between items-center mb-6">
                        <div>
                        </div>
                        <button
                          onClick={() => setShowCreateObject(true)}
                          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          Create New Object
                        </button>
                      </div>

                      {/* Search Bar */}
                      <div className="mb-6">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search objects..."
                            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={objectSearchQuery}
                            onChange={(e) => setObjectSearchQuery(e.target.value)}
                          />
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      
                      {/* Object List Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Name</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredObjects.map((obj) => (
                              <tr key={obj.table_name}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  <div className="flex items-center">
                                    <span className="mr-2 text-lg">{getObjectIcon(obj.table_name)}</span>
                                    <button
                                      onClick={() => setSelectedObject(obj.table_name)}
                                      className="text-blue-600 hover:text-blue-900"
                                    >
                                      {obj.label || obj.table_name}
                                    </button>
                                    {isSystemObject(obj.table_name) && (
                                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        System Object
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{obj.table_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{obj.table_type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    // Selected Object View (Details, Fields, Layout, Validation)
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                      {/* Object Header */}
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">{selectedObject.charAt(0).toUpperCase() + selectedObject.slice(1)}</h2>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => setSelectedObject(null)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                          >
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to All Objects
                          </button>
                        </div>
                      </div>

                      {/* Details View */}
                      {activeSection === 'details' && (
                        <div>
                          {!isEditingObject ? (
                            <>
                              <h3 className="text-lg font-bold text-gray-900 mb-4">Object Details</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <label className="text-sm font-medium text-gray-500">Label</label>
                                  <p className="text-lg text-gray-900">
                                    {objects.find(o => o.table_name === selectedObject)?.label || (selectedObject.charAt(0).toUpperCase() + selectedObject.slice(1))}
                                  </p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                  <label className="text-sm font-medium text-gray-500">API Name</label>
                                  <p className="text-lg text-gray-900">{selectedObject}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => {
                                    const currentObject = objects.find(o => o.table_name === selectedObject);
                                    const currentLabel = currentObject?.label || (selectedObject.charAt(0).toUpperCase() + selectedObject.slice(1));
                                    setEditingObjectLabel(currentLabel);
                                    setIsEditingObject(true);
                                  }}
                                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                                >
                                  Edit Label
                                </button>
                                <button
                                    onClick={() => handleDeleteObject(selectedObject)}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
                                  >
                                    <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    Archive Object
                                  </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Details</h3>
                              <div className="space-y-4">
                                <div>
                                  <label htmlFor="object-label" className="block text-sm font-medium text-gray-700">Label</label>
                                  <input
                                    type="text"
                                    id="object-label"
                                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                    value={editingObjectLabel}
                                    onChange={(e) => setEditingObjectLabel(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label htmlFor="object-api-name" className="block text-sm font-medium text-gray-700">API Name</label>
                                  <input
                                    type="text"
                                    id="object-api-name"
                                    className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md bg-gray-100"
                                    value={selectedObject}
                                    disabled
                                  />
                                  <p className="mt-1 text-sm text-gray-500">The API Name is the database table name and cannot be changed.</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 mt-6">
                                <button
                                  onClick={handleSaveObjectLabel}
                                  disabled={saving}
                                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setIsEditingObject(false)}
                                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                          </div>
                      )}

                      {/* Fields List */}
                      {activeSection === 'fields' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Fields</h3>
                            <button
                              onClick={() => setShowCreateField(true)}
                              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              New Field
                            </button>
                          </div>

                          <div className="space-y-4">
                            {filteredFields.map((field) => (
                              <div key={field.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <span className="text-xl">{getFieldIcon(field.field_type, !!field.reference_table)}</span>
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-medium text-gray-900">{field.display_label}</h4>
                                        {field.is_system_field && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            System
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-500">{field.api_name}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {!field.is_system_field && (
                                      <>
                                        <button
                                          onClick={() => handleEditField(field)}
                                          className="text-gray-400 hover:text-gray-500"
                                          title="Edit field"
                                        >
                                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleDeleteField(field.id, field.api_name)}
                                          className="text-red-400 hover:text-red-500 disabled:text-gray-300"
                                          title="Delete field"
                                          disabled={saving}
                                        >
                                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Page Layout View */}
                      {activeSection === 'layout' && (
                        <ObjectLayoutEditor
                          selectedObject={selectedObject}
                          fieldMetadata={fieldMetadata}
                          relatedLists={relatedLists}
                          onLayoutChange={() => {
                            fetchFieldMetadata(selectedObject!);
                            fetchRelatedLists(selectedObject!);
                          }}
                          getFieldIcon={getFieldIcon}
                          handleEditField={handleEditField}
                          isSystemField={(apiName) => fieldMetadata.find(f => f.api_name === apiName)?.is_system_field || false}
                          onEditRelatedList={(list) => {
                            setEditingRelatedList(list);
                            setShowEditRelatedList(true);
                          }}
                          onDeleteRelatedList={handleDeleteRelatedList}
                          onAddRelatedList={() => setShowCreateRelatedList(true)}
                        />
                      )}

                      {/* Validation Rules View */}
                      {activeSection === 'validation' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Validation Rules</h3>
                            <button onClick={() => setShowCreateRule(true)} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700">
                              New Rule
                            </button>
                          </div>
                          {validationRules.map(rule => (
                            <div key={rule.id} className="border p-4 rounded-lg bg-gray-50">
                              <p><strong>Field:</strong> {rule.field}</p>
                              <p><strong>Type:</strong> {rule.type}</p>
                              <p><strong>Value:</strong> {rule.value}</p>
                              <p><strong>Message:</strong> {rule.message}</p>
                            </div>
                          ))}
                          {validationRules.length === 0 && (
                            <p className="text-gray-500">No validation rules defined for this object yet.</p>
                          )}
                        </div>
                      )}

                      {/* Related Lists View */}
                      {activeSection === 'related_lists' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Related Lists</h3>
                            <button 
                              onClick={() => setShowCreateRelatedList(true)} 
                              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
                            >
                              New Related List
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            {relatedLists.map((relatedList) => (
                              <div key={relatedList.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <span className="text-xl">🔗</span>
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-medium text-gray-900">{relatedList.label}</h4>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                          {relatedList.child_table}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-500">
                                        Foreign Key: {relatedList.foreign_key_field} | Section: {relatedList.section}
                                      </p>
                                      <p className="text-xs text-gray-400">
                                        Display Columns: {relatedList.display_columns.join(', ')}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => {
                                        setEditingRelatedList(relatedList);
                                        setShowEditRelatedList(true);
                                      }}
                                      className="text-gray-400 hover:text-gray-500"
                                      title="Edit related list"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRelatedList(relatedList.id, relatedList.label)}
                                      className="text-red-400 hover:text-red-500 disabled:text-gray-300"
                                      title="Delete related list"
                                      disabled={saving}
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {relatedLists.length === 0 && (
                              <div className="text-center py-8">
                                <div className="text-gray-400 text-6xl mb-4">🔗</div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Related Lists</h3>
                                <p className="text-gray-500 mb-4">
                                  Create related lists to show connected records from other objects.
                                </p>
                                <button 
                                  onClick={() => setShowCreateRelatedList(true)} 
                                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                                >
                                  Create Your First Related List
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Field Modal */}
      {showCreateField && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Create New Field
                    </h3>
                    <div className="mt-2 space-y-4">
                      <div>
                        <label htmlFor="field-display-label" className="block text-sm font-medium text-gray-700">Display Label</label>
                        <input
                          type="text"
                          id="field-display-label"
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={newField.display_label}
                          onChange={(e) => {
                            const displayLabel = e.target.value;
                            setNewField({
                              ...newField,
                              display_label: displayLabel,
                              api_name: generateApiName(displayLabel)
                            });
                          }}
                        />
                      </div>
                      <div>
                        <label htmlFor="field-api-name" className="block text-sm font-medium text-gray-700">API Name</label>
                        <input
                          type="text"
                          id="field-api-name"
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={newField.api_name}
                          onChange={(e) => setNewField({ ...newField, api_name: e.target.value })}
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
                      <div className="flex items-center">
                        <input
                          id="is-required"
                          name="is-required"
                          type="checkbox"
                          className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          checked={newField.is_required}
                          onChange={(e) => setNewField({ ...newField, is_required: e.target.checked, is_nullable: !e.target.checked })}
                        />
                        <label htmlFor="is-required" className="ml-2 block text-sm text-gray-900">
                          Required Field
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleCreateField}
                  disabled={creatingField}
                >
                  {creatingField ? 'Creating...' : 'Create New Field'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowCreateField(false);
                    resetNewField();
                    setMessage('');
                  }}
                  disabled={creatingField}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Object Modal */}
      {showCreateObject && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Create New Object
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="object-label" className="block text-sm font-medium text-gray-700">Object Label</label>
                        <input
                          type="text"
                          id="object-label"
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={newObject.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            setNewObject({
                              ...newObject,
                              label,
                              api_name: generateApiName(label)
                            });
                          }}
                          placeholder="Enter object label (e.g., Products)"
                        />
                      </div>
                      <div>
                        <label htmlFor="object-api-name" className="block text-sm font-medium text-gray-700">API Name</label>
                        <input
                          type="text"
                          id="object-api-name"
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={newObject.api_name}
                          onChange={(e) => setNewObject({ ...newObject, api_name: e.target.value })}
                          placeholder="Enter API name (e.g., products)"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          API name must start with a letter and contain only letters, numbers, and underscores.
                        </p>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="create-tab"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={newObject.create_tab}
                          onChange={(e) => setNewObject({ ...newObject, create_tab: e.target.checked })}
                        />
                        <label htmlFor="create-tab" className="ml-2 block text-sm text-gray-900">
                          Create Navigation Tab
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="auto-number"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={newObject.auto_number}
                          onChange={(e) => setNewObject({ ...newObject, auto_number: e.target.checked })}
                        />
                        <label htmlFor="auto-number" className="ml-2 block text-sm text-gray-900">
                          Enable Auto-numbering for Records
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleCreateObject}
                  disabled={creatingObject}
                >
                  {creatingObject ? 'Creating...' : 'Create Object'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowCreateObject(false);
                    setNewObject({
                      label: '',
                      api_name: '',
                      create_tab: true,
                      auto_number: true
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Related List Modal */}
      {showCreateRelatedList && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Create New Related List
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="related-list-label" className="block text-sm font-medium text-gray-700">Display Label</label>
                        <input
                          type="text"
                          id="related-list-label"
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={newRelatedList.label}
                          onChange={(e) => setNewRelatedList({ ...newRelatedList, label: e.target.value })}
                          placeholder="e.g., Related Contacts"
                        />
                      </div>
                      <div>
                        <label htmlFor="child-table" className="block text-sm font-medium text-gray-700">Child Object</label>
                        <select
                          id="child-table"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                          value={newRelatedList.child_table}
                          onChange={(e) => setNewRelatedList({ ...newRelatedList, child_table: e.target.value })}
                        >
                          <option value="">Select a child object</option>
                          {objects.map((obj) => (
                            <option key={obj.table_name} value={obj.table_name}>
                              {obj.label || obj.table_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="foreign-key-field" className="block text-sm font-medium text-gray-700">Foreign Key Field</label>
                        <input
                          type="text"
                          id="foreign-key-field"
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={newRelatedList.foreign_key_field}
                          onChange={(e) => setNewRelatedList({ ...newRelatedList, foreign_key_field: e.target.value })}
                          placeholder="e.g., client_id"
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          The field in the child object that references this object's ID.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleCreateRelatedList}
                  disabled={creatingRelatedList}
                >
                  {creatingRelatedList ? 'Creating...' : 'Create Related List'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowCreateRelatedList(false);
                    setNewRelatedList({
                      child_table: '',
                      foreign_key_field: '',
                      label: '',
                      display_columns: ['id', 'name'],
                      section: 'details'
                    });
                  }}
                  disabled={creatingRelatedList}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg ${message.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}
    </div>
  );
}

