'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { createClient } from '@supabase/supabase-js';
import FieldDragItem from './FieldDragItem';
import { useToast } from './Toast';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface LayoutBlock {
  id: string;
  table_name: string;
  block_type: 'field' | 'related_list';
  field_id?: string;
  related_table?: string;
  foreign_key?: string;
  label: string;
  section: string;
  display_order: number;
  width?: string;
  created_at?: string;
  updated_at?: string;
  related_list_id?: string;
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

export const ItemTypes = {
  FIELD: 'field',
  RELATED_LIST: 'relatedList',
  LAYOUT_BLOCK: 'layoutBlock',
};

interface ObjectLayoutEditorProps {
  selectedObject: string | null;
  fieldMetadata: FieldMetadata[];
  relatedLists: RelatedList[];
  onLayoutChange: () => void;
  getFieldIcon: (dataType: string, isReference?: boolean) => string;
  handleEditField: (field: FieldMetadata) => void;
  isSystemField: (apiName: string) => boolean;
  onEditRelatedList: (relatedList: RelatedList) => void;
  onDeleteRelatedList: (relatedListId: string, label: string) => void;
  onAddRelatedList: () => void;
}

export default function ObjectLayoutEditor({
  selectedObject,
  fieldMetadata,
  relatedLists,
  onLayoutChange,
  getFieldIcon,
  handleEditField,
  isSystemField,
  onEditRelatedList,
  onDeleteRelatedList,
  onAddRelatedList,
}: ObjectLayoutEditorProps) {
  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>([]);
  const [customLayoutSections, setCustomLayoutSections] = useState<string[]>([]);
  const [fieldPoolSearchQuery, setFieldPoolSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreateSectionModal, setShowCreateSectionModal] = useState(false);
  const [newSection, setNewSection] = useState({ name: '', type: 'field' as 'field' | 'related' });
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [showLayoutSavedDialog, setShowLayoutSavedDialog] = useState(false);
  const [showRelatedListModal, setShowRelatedListModal] = useState(false);
  const [selectedSectionForRelatedList, setSelectedSectionForRelatedList] = useState<string>('details');
  const [selectedDisplayColumns, setSelectedDisplayColumns] = useState<string[]>(['id', 'name']);
  
  const { showToast } = useToast();

  // Fetch layout blocks when object changes
  useEffect(() => {
    if (selectedObject) {
      fetchLayoutBlocks(selectedObject);
    }
  }, [selectedObject]);

  // Update custom sections when layout blocks change
  useEffect(() => {
    if (layoutBlocks.length > 0) {
      const customSections = Array.from(
        new Set(
          layoutBlocks
            .map(block => block.section)
            .filter(section => section && section !== '' && !['details', 'basic', 'system'].includes(section))
        )
      );
      setCustomLayoutSections(customSections);
    }
  }, [layoutBlocks]);

  const fetchLayoutBlocks = async (tableName: string) => {
    try {
      console.log('🔍 Fetching layout blocks for table:', tableName);
      
      const { data, error } = await supabase.rpc('get_layout_blocks', { 
        p_table_name: tableName 
      });
      
      if (error) {
        console.error('❌ Error fetching layout blocks:', error);
        setLayoutBlocks([]);
      } else {
        console.log('✅ Fetched layout blocks:', data);
        setLayoutBlocks(data || []);
      }
    } catch (err) {
      console.error('❌ Unexpected error fetching layout blocks:', err);
      setLayoutBlocks([]);
    }
  };

  const handleSaveLayout = async () => {
    if (!selectedObject) return;

    setSaving(true);
    setMessage('');
    try {
      const layoutToSave = layoutBlocks.map(b => ({
        id: b.id.toString().startsWith('temp-') ? null : b.id,
        block_type: b.block_type,
        field_id: b.block_type === 'field' ? b.field_id : null,
        related_list_id: b.block_type === 'related_list' ? b.related_list_id : null,
        label: b.label,
        section: b.section,
        display_order: b.display_order,
        width: b.width
      }));

      console.log('💾 Saving layout for table:', selectedObject);
      console.log('💾 Layout data to save:', layoutToSave);

      const { data: savedBlocks, error } = await supabase.rpc('update_layout_blocks', {
        p_table_name: selectedObject,
        p_layout_blocks: layoutToSave
      });

      if (error) {
        throw error;
      }

      // Instead of re-fetching, update state with the returned data from the RPC.
      // This is more efficient and keeps the UI in sync instantly.
      console.log('✅ Layout saved, server returned:', savedBlocks);
      if (savedBlocks) {
        setLayoutBlocks(savedBlocks);
      } else {
        // Fallback to refetch if the RPC doesn't return data, just in case.
        await fetchLayoutBlocks(selectedObject);
      }
      
      onLayoutChange();

      // showToast('✅ Page layout saved successfully!', 'success');
      setShowLayoutSavedDialog(true);
    } catch (err: any) {
      console.error('❌ Error saving layout:', err);
      showToast(`❌ Error saving layout: ${err.message || 'An unexpected error occurred'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const moveBlock = useCallback(
    (draggedId: string, hoverId: string, draggedSection: string, hoverSection: string) => {
      setLayoutBlocks((prevBlocks) => {
        const draggedBlock = prevBlocks.find((block) => block.id === draggedId);
        if (!draggedBlock) {
          return prevBlocks;
        }

        // Create a copy of the dragged block with its updated section
        const updatedDraggedBlock = { ...draggedBlock, section: hoverSection };

        // Filter out the dragged block from its original position
        let newBlocks = prevBlocks.filter((block) => block.id !== draggedId);

        // Find the index to insert the dragged block
        let insertIndex = -1;
        if (hoverId) {
          insertIndex = newBlocks.findIndex((block) => block.id === hoverId);
        }

        if (insertIndex > -1) {
          newBlocks.splice(insertIndex, 0, updatedDraggedBlock);
        } else {
          // If no hoverId, or hoverId not found, add to the end of the hoverSection
          const lastIndexInHoverSection = newBlocks.reduce((latestIndex, block, idx) => {
            if (block.section === hoverSection) {
              return idx;
            }
            return latestIndex;
          }, -1);
          
          if (lastIndexInHoverSection > -1) {
            newBlocks.splice(lastIndexInHoverSection + 1, 0, updatedDraggedBlock);
          } else {
            // If hoverSection is empty or not found, just push it to the end of the array
            newBlocks.push(updatedDraggedBlock);
          }
        }

        // Re-assign display_order based on their position
        const reorderedBlocks = newBlocks.map((block, index) => ({
          ...block,
          display_order: index,
        }));

        return reorderedBlocks;
      });
    },
    [],
  );

  const addFieldToLayout = (field: FieldMetadata, section: string) => {
    const newBlock: LayoutBlock = {
      id: `temp-${Date.now()}-${Math.random()}`,
      table_name: selectedObject!,
      block_type: 'field',
      field_id: field.id,
      label: field.display_label,
      section: section,
      display_order: layoutBlocks.filter(b => b.section === section).length,
      width: field.width || 'half'
    };

    setLayoutBlocks(prev => [...prev, newBlock]);
    // showToast(`✅ Added field "${field.display_label}" to ${section} section`, 'success');
  };

  const addRelatedListToLayout = (relatedList: RelatedList, section: string) => {
    const newBlock: LayoutBlock = {
      id: `temp-${Date.now()}-${Math.random()}`,
      table_name: selectedObject!,
      block_type: 'related_list',
      related_list_id: relatedList.id,
      label: relatedList.label,
      section: section,
      display_order: layoutBlocks.filter(b => b.section === section).length,
      width: 'full' // Related lists typically take full width
    };

    setLayoutBlocks(prev => [...prev, newBlock]);
    // showToast(`✅ Added related list "${relatedList.label}" to ${section} section`, 'success');
  };

  const removeBlockFromLayout = (blockId: string) => {
    const block = layoutBlocks.find(b => b.id === blockId);
    if (block) {
      setLayoutBlocks(prev => prev.filter(b => b.id !== blockId));
      // showToast(`✅ Removed "${block.label}" from layout`, 'info');
    }
  };

  const handleAddLayoutSection = () => {
    if (newSection.name.trim() && !customLayoutSections.some(section => section.toLowerCase() === newSection.name.trim().toLowerCase())) {
      setCustomLayoutSections(prev => [...prev, newSection.name.trim().toLowerCase()]);
      setNewSection({ name: '', type: 'field' });
      setShowCreateSectionModal(false);
    }
  };

  const handleRemoveLayoutSection = (sectionToRemove: string) => {
    if (sectionToRemove === 'details') {
      setMessage('❌ Cannot remove the details section.');
      return;
    }
    
    if (confirm(`Are you sure you want to remove the section '${sectionToRemove}'? This will move all blocks in this section to the 'details' section.`)) {
      setCustomLayoutSections(prev => prev.filter(s => s !== sectionToRemove));
      // Move blocks from the removed section to 'details'
      setLayoutBlocks(prev => prev.map(block =>
        block.section === sectionToRemove ? { ...block, section: 'details' } : block
      ));
    }
  };

  const handleUpdateSectionName = () => {
    if (!editingSection || !newSection.name.trim()) return;

    const oldName = editingSection;
    const newName = newSection.name.trim().toLowerCase();

    // Do nothing if the name hasn't changed or the new name already exists
    if (oldName === newName || customLayoutSections.includes(newName)) {
      setEditingSection(null);
      setShowCreateSectionModal(false);
      setNewSection({ name: '', type: 'field' });
      return;
    }

    // 1. Update the customLayoutSections array
    setCustomLayoutSections(prevSections =>
      prevSections.map(s => (s === oldName ? newName : s))
    );

    // 2. Update the blocks in layoutBlocks
    setLayoutBlocks(prevBlocks =>
      prevBlocks.map(block => (block.section === oldName ? { ...block, section: newName } : block))
    );

    // 3. Reset state
    setEditingSection(null);
    setShowCreateSectionModal(false);
    setNewSection({ name: '', type: 'field' });
  };

  // Get fields that are not in any layout section
  const getAvailableFields = () => {
    const usedFieldIds = layoutBlocks
      .filter(block => block.block_type === 'field')
      .map(block => block.field_id);
    
    return fieldMetadata.filter(field => !usedFieldIds.includes(field.id));
  };

  // Get related lists that are not in any layout section
  const getAvailableRelatedLists = () => {
    const usedRelatedListIds = layoutBlocks
      .filter(block => block.block_type === 'related_list')
      .map(block => block.related_list_id);
    
    return relatedLists.filter(list => !usedRelatedListIds.includes(list.id));
  };

  const handleAddRelatedListToSection = (section: string) => {
    setSelectedSectionForRelatedList(section);
    setShowRelatedListModal(true);
  };

  const handleCreateRelatedListForSection = async (relatedListData: any) => {
    try {
      // This will be handled by the parent component
      onAddRelatedList();
      setShowRelatedListModal(false);
    } catch (error) {
      showToast('❌ Error creating related list', 'error');
    }
  };

  // Handle drops from field pool
  const handleDropFromPool = (dropResult: any) => {
    if (dropResult.type === 'field' && dropResult.field) {
      addFieldToLayout(dropResult.field, dropResult.targetSection);
    } else if (dropResult.type === 'relatedList' && dropResult.relatedList) {
      addRelatedListToLayout(dropResult.relatedList, dropResult.targetSection);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Page Layout</h3>
        <button 
          onClick={handleSaveLayout} 
          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
        >
          {saving ? 'Saving...' : 'Save Layout'}
        </button>
      </div>
      
      {/* Field Pool */}
      <FieldPool
        availableFields={getAvailableFields()}
        availableRelatedLists={getAvailableRelatedLists()}
        searchQuery={fieldPoolSearchQuery}
        onSearchChange={setFieldPoolSearchQuery}
        getFieldIcon={getFieldIcon}
        onAddField={addFieldToLayout}
        onAddRelatedList={onAddRelatedList}
      />
      
      <div className="space-y-4">
        <LayoutSection
          key="details"
          section="details"
          blocks={layoutBlocks.filter(block => block.section === 'details')}
          fieldMetadata={fieldMetadata}
          relatedLists={relatedLists}
          moveBlock={moveBlock}
          onRemoveSection={handleRemoveLayoutSection}
          onRenameSection={(sectionName) => {
            setEditingSection(sectionName);
            setNewSection({ name: sectionName, type: 'field' });
            setShowCreateSectionModal(true);
          }}
          getFieldIcon={getFieldIcon}
          handleEditField={handleEditField}
          isSystemField={isSystemField}
          onEditRelatedList={onEditRelatedList}
          onDeleteRelatedList={onDeleteRelatedList}
          onRemoveBlock={removeBlockFromLayout}
          onDropFromPool={handleDropFromPool}
        />
        {customLayoutSections.map(section => (
          <LayoutSection
            key={section}
            section={section}
            blocks={layoutBlocks.filter(block => block.section === section)}
            fieldMetadata={fieldMetadata}
            relatedLists={relatedLists}
            moveBlock={moveBlock}
            onRemoveSection={handleRemoveLayoutSection}
            onRenameSection={(sectionName) => {
              setEditingSection(sectionName);
              setNewSection({ name: sectionName, type: 'field' });
              setShowCreateSectionModal(true);
            }}
            getFieldIcon={getFieldIcon}
            handleEditField={handleEditField}
            isSystemField={isSystemField}
            onEditRelatedList={onEditRelatedList}
            onDeleteRelatedList={onDeleteRelatedList}
            onRemoveBlock={removeBlockFromLayout}
            onDropFromPool={handleDropFromPool}
          />
        ))}
      </div>

      <div className="mt-4">
        <button 
          onClick={() => setShowCreateSectionModal(true)} 
          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
        >
          Add Section
        </button>
      </div>

      {/* Create or Rename Section Modal */}
      {showCreateSectionModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      {editingSection ? 'Rename Section' : 'Create New Section'}
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label htmlFor="section-name" className="block text-sm font-medium text-gray-700">Section Name</label>
                        <input
                          type="text"
                          id="section-name"
                          className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          value={newSection.name}
                          onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                          placeholder="Enter section name"
                        />
                      </div>
                      
                      {!editingSection && (
                        <>
                          <div>
                            <label htmlFor="section-type" className="block text-sm font-medium text-gray-700">Section Type</label>
                            <select
                              id="section-type"
                              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                              value={newSection.type}
                              onChange={(e) => setNewSection({ ...newSection, type: e.target.value as 'field' | 'related' })}
                            >
                              <option value="field">Field Section</option>
                              <option value="related">Related List Section</option>
                            </select>
                            <p className="mt-1 text-sm text-gray-500">
                              {newSection.type === 'field' 
                                ? 'Fields in this section will be displayed in a 2-column layout.' 
                                : 'This section will display related records from other objects.'}
                            </p>
                          </div>
                          
                          {newSection.type === 'related' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Display Columns</label>
                              <div className="space-y-2">
                                {['id', 'name', 'email', 'created_at'].map((column) => (
                                  <label key={column} className="flex items-center">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                      checked={selectedDisplayColumns.includes(column)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedDisplayColumns([...selectedDisplayColumns, column]);
                                        } else {
                                          setSelectedDisplayColumns(selectedDisplayColumns.filter(c => c !== column));
                                        }
                                      }}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">{column}</span>
                                  </label>
                                ))}
                              </div>
                              <p className="mt-1 text-sm text-gray-500">
                                Select which columns to display in the related list.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={editingSection ? handleUpdateSectionName : handleAddLayoutSection}
                >
                  {editingSection ? 'Save Changes' : 'Create Section'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setShowCreateSectionModal(false);
                    setNewSection({ name: '', type: 'field' });
                    setEditingSection(null);
                    setSelectedDisplayColumns(['id', 'name']);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layout Saved Success Dialog */}
      {showLayoutSavedDialog && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen text-center sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Layout Saved Successfully!
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Your page layout has been saved to the database. The changes will persist across sessions and be available to all users.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowLayoutSavedDialog(false)}
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-md ${message.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}
    </div>
  );
}

// Layout Section Component
interface LayoutSectionProps {
  section: string;
  blocks: LayoutBlock[];
  fieldMetadata: FieldMetadata[];
  relatedLists: RelatedList[];
  moveBlock: (draggedId: string, hoverId: string, draggedSection: string, hoverSection: string) => void;
  onRemoveSection: (sectionName: string) => void;
  onRenameSection: (sectionName: string) => void;
  getFieldIcon: (dataType: string, isReference?: boolean) => string;
  handleEditField: (field: FieldMetadata) => void;
  isSystemField: (apiName: string) => boolean;
  onEditRelatedList: (relatedList: RelatedList) => void;
  onDeleteRelatedList: (relatedListId: string, label: string) => void;
  onRemoveBlock: (blockId: string) => void;
  onDropFromPool: (dropResult: any) => void;
}

const LayoutSection: React.FC<LayoutSectionProps> = ({
  section,
  blocks,
  fieldMetadata,
  relatedLists,
  moveBlock,
  onRemoveSection,
  onRenameSection,
  getFieldIcon,
  handleEditField,
  isSystemField,
  onEditRelatedList,
  onDeleteRelatedList,
  onRemoveBlock,
  onDropFromPool,
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: [ItemTypes.LAYOUT_BLOCK, ItemTypes.FIELD, ItemTypes.RELATED_LIST],
    drop: (item: any) => {
      // Logic to handle different dropped item types
      if (item.section === 'pool') {
        onDropFromPool({ ...item, targetSection: section });
      } else if (item.section !== section) {
        moveBlock(item.id, '', item.section, section);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  return (
    <div
      // @ts-ignore
      ref={drop}
      className={`bg-gray-50 p-4 rounded-md shadow-sm transition-colors ${
        isOver && canDrop ? 'bg-blue-50 border-2 border-blue-300' : ''
      }`}
    >
      <h3 className="text-lg font-semibold mb-2 flex justify-between items-center">
        <span>{section}</span>
        {section !== 'basic' && section !== 'system' && (
          <div className="flex items-center space-x-4">
            <button
              onClick={() => onRenameSection(section)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Rename
            </button>
            {section !== 'details' && (
              <button
                onClick={() => onRemoveSection(section)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {blocks.length === 0 && (
          <p className="text-gray-500 col-span-2">Drag fields or related lists here.</p>
        )}
        {blocks.map((block) => (
          <LayoutBlockItem
            key={block.id}
            block={block}
            fieldMetadata={fieldMetadata}
            relatedLists={relatedLists}
            moveBlock={moveBlock}
            getFieldIcon={getFieldIcon}
            handleEditField={handleEditField}
            isSystemField={isSystemField}
            onEditRelatedList={onEditRelatedList}
            onDeleteRelatedList={onDeleteRelatedList}
            onRemoveBlock={onRemoveBlock}
          />
        ))}
      </div>
    </div>
  );
};

// Layout Block Item Component
interface LayoutBlockItemProps {
  block: LayoutBlock;
  fieldMetadata: FieldMetadata[];
  relatedLists: RelatedList[];
  moveBlock: (draggedId: string, hoverId: string, draggedSection: string, hoverSection: string) => void;
  getFieldIcon: (dataType: string, isReference?: boolean) => string;
  handleEditField: (field: FieldMetadata) => void;
  isSystemField: (apiName: string) => boolean;
  onEditRelatedList: (relatedList: RelatedList) => void;
  onDeleteRelatedList: (relatedListId: string, label: string) => void;
  onRemoveBlock: (blockId: string) => void;
}

const LayoutBlockItem: React.FC<LayoutBlockItemProps> = ({
  block,
  fieldMetadata,
  relatedLists,
  moveBlock,
  getFieldIcon,
  handleEditField,
  isSystemField,
  onEditRelatedList,
  onDeleteRelatedList,
  onRemoveBlock,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.LAYOUT_BLOCK,
    item: { id: block.id, section: block.section },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.LAYOUT_BLOCK,
    hover: (item: { id: string; section: string }) => {
      if (item.id !== block.id) {
        moveBlock(item.id, block.id, item.section, block.section);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  drag(drop(ref));

  if (block.block_type === 'field') {
    const field = fieldMetadata.find(f => f.id === block.field_id);
    if (!field) return null;

    return (
      <div
        ref={ref}
        style={{ opacity: isDragging ? 0.5 : 1 }}
        className={`${block.width === 'full' ? 'col-span-2' : 'col-span-1'} bg-white border border-gray-200 rounded-lg p-3 cursor-grab hover:bg-gray-50 transition-colors ${
          isOver ? 'border-blue-300 bg-blue-50' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">{getFieldIcon(field.field_type, !!field.reference_table)}</span>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-medium text-gray-900">{field.display_label}</h4>
                {isSystemField(field.api_name) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    System
                  </span>
                )}
                {field.reference_table && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {field.reference_table}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{field.api_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEditField(field)}
              className="text-gray-400 hover:text-gray-500"
              title="Edit field"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={() => onRemoveBlock(block.id)}
              className="text-red-400 hover:text-red-500"
              title="Remove from layout"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  } else if (block.block_type === 'related_list') {
    const relatedList = relatedLists.find(rl => rl.id === block.related_list_id);

    return (
      <div
        ref={ref}
        style={{ opacity: isDragging ? 0.5 : 1 }}
        className={`${block.width === 'full' ? 'col-span-2' : 'col-span-1'} bg-blue-50 border border-blue-200 rounded-lg p-3 cursor-grab hover:bg-blue-100 transition-colors ${
          isOver ? 'border-blue-300 bg-blue-100' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">🔗</span>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-medium text-blue-900">{block.label}</h4>
                {relatedList && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {relatedList.child_table}
                  </span>
                )}
              </div>
              {relatedList && (
                <p className="text-xs text-blue-600">
                  FK: {relatedList.foreign_key_field}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {relatedList && (
              <>
                <button
                  onClick={() => onEditRelatedList(relatedList)}
                  className="text-blue-400 hover:text-blue-500"
                  title="Edit related list"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDeleteRelatedList(relatedList.id, relatedList.label)}
                  className="text-red-400 hover:text-red-500"
                  title="Delete related list"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={() => onRemoveBlock(block.id)}
              className="text-red-400 hover:text-red-500"
              title="Remove from layout"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Field Pool Component
interface FieldPoolProps {
  availableFields: FieldMetadata[];
  availableRelatedLists: RelatedList[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  getFieldIcon: (dataType: string, isReference?: boolean) => string;
  onAddField: (field: FieldMetadata, section: string) => void;
  onAddRelatedList: () => void;
}

const FieldPool: React.FC<FieldPoolProps> = ({
  availableFields,
  availableRelatedLists,
  searchQuery,
  onSearchChange,
  getFieldIcon,
  onAddField,
  onAddRelatedList,
}) => {
  const [activePoolTab, setActivePoolTab] = useState<'fields' | 'related'>('fields');

  // Filter fields and related lists based on search query
  const filteredFields = availableFields.filter(field =>
    field.display_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.api_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRelatedLists = availableRelatedLists.filter(list =>
    list.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    list.child_table.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Available Fields & Components</h4>
        <div className="relative">
          <input
            type="text"
            placeholder={`Search ${activePoolTab === 'fields' ? 'fields' : 'related lists'}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-48 pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* New 20%/80% split design */}
      <div className="h-72 w-full border rounded bg-gray-50 flex">
        {/* 20% vertical tab rail */}
        <div className="w-1/5 border-r flex flex-col">
          {(['fields', 'related'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActivePoolTab(tab)}
              className={`px-3 py-2 text-left text-sm transition-colors
                ${activePoolTab === tab 
                  ? 'bg-white font-semibold text-blue-600 border-r-2 border-blue-600' 
                  : 'hover:bg-gray-100 text-gray-700'}`}
            >
              {tab === 'fields' ? '📄 Fields' : '🔗 Related Fields'}
            </button>
          ))}
        </div>

        {/* 80% dynamic list */}
        <div className="w-4/5 p-2 overflow-y-auto">
          {activePoolTab === 'fields' ? (
            <div className="space-y-1">
              {filteredFields.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  {searchQuery ? 'No fields match your search' : 'All fields are already in layout sections'}
                </div>
              ) : (
                filteredFields.map((field) => (
                  <FieldPoolItem
                    key={field.id}
                    field={field}
                    getFieldIcon={getFieldIcon}
                    onAddField={onAddField}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Always show the "Add Related List" option */}
              <RelatedListPoolItem onAddRelatedList={onAddRelatedList} />
              
              {filteredRelatedLists.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  {searchQuery ? 'No related lists match your search' : 'No related lists available'}
                </div>
              ) : (
                filteredRelatedLists.map((relatedList) => (
                  <RelatedListPoolItem
                    key={relatedList.id}
                    relatedList={relatedList}
                    onAddRelatedList={() => onAddRelatedList()}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Individual Field Pool Item
interface FieldPoolItemProps {
  field: FieldMetadata;
  getFieldIcon: (dataType: string, isReference?: boolean) => string;
  onAddField: (field: FieldMetadata, section: string) => void;
}

const FieldPoolItem: React.FC<FieldPoolItemProps> = ({ field, getFieldIcon, onAddField }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.FIELD,
    item: { 
      type: 'field',
      field: field,
      section: 'pool' 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  drag(ref);

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs cursor-grab hover:bg-gray-100 transition-colors"
      onClick={() => onAddField(field, 'details')}
    >
      <span className="text-sm">{getFieldIcon(field.field_type, !!field.reference_table)}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{field.display_label}</div>
        <div className="text-gray-500 truncate">{field.api_name}</div>
      </div>
    </div>
  );
};

// Related List Pool Item
interface RelatedListPoolItemProps {
  relatedList?: RelatedList;
  onAddRelatedList: () => void;
}

const RelatedListPoolItem: React.FC<RelatedListPoolItemProps> = ({ relatedList, onAddRelatedList }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.RELATED_LIST,
    item: { 
      type: 'relatedList', 
      relatedList: relatedList,
      section: 'pool' 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  drag(ref);

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs cursor-grab hover:bg-blue-100 transition-colors"
      onClick={() => onAddRelatedList()}
    >
      <span className="text-sm">🔗</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-blue-900 truncate">
          {relatedList ? relatedList.label : 'Add Related List'}
        </div>
        <div className="text-blue-500 truncate">
          {relatedList ? 'Drag to layout or click to configure' : 'Click to create new related list'}
        </div>
      </div>
    </div>
  );
}; 