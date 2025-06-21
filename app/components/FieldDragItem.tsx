'use client';

import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { FieldMetadata } from './SettingsManager'; // Assuming FieldMetadata is exported

interface FieldDragItemProps {
  field: FieldMetadata;
  moveField: (draggedId: string, hoverId: string, draggedSection: string, hoverSection: string) => void;
  onUpdateFieldProperty: (fieldId: string, property: keyof FieldMetadata, value: any) => void;
  isSystemField: (objectName: string) => boolean; // Helper to hide edit button on system fields
  getFieldIcon: (dataType: string, isReference?: boolean) => string; // Pass the getFieldIcon helper
  handleEditField: (field: FieldMetadata) => void; // Added handleEditField to props
}

const ItemTypes = {
  FIELD: 'field',
};

const FieldDragItem: React.FC<FieldDragItemProps> = ({
  field,
  moveField,
  onUpdateFieldProperty,
  isSystemField: checkIsSystemField,
  getFieldIcon,
  handleEditField,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.FIELD,
    item: { id: field.id, section: field.section }, // Use field.id directly
    collect: (monitor) => {
      console.log(`Field ${field.display_label} isDragging:`, monitor.isDragging());
      return {
        isDragging: monitor.isDragging(),
      };
    },
  }));

  const [, drop] = useDrop(() => ({
    accept: ItemTypes.FIELD,
    hover(item: { id: string; section: string }, monitor) {
      if (!ref.current) {
        return;
      }
      const draggedId = item.id; // ID of the dragged item
      const hoverId = field.id; // ID of the hovered item
      const draggedSection = item.section; // Section of the dragged item
      const hoverSection = field.section; // Section of the hovered item

      // Don't replace items with themselves unless changing sections
      if (draggedId === hoverId && draggedSection === hoverSection) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards within the same section
      if (draggedId < hoverId && hoverClientY < hoverMiddleY && draggedSection === hoverSection) {
        return;
      }

      // Dragging upwards within the same section
      if (draggedId > hoverId && hoverClientY > hoverMiddleY && draggedSection === hoverSection) {
        return;
      }

      // If dragging across sections, always allow the move if over a valid drop target
      if (draggedSection !== hoverSection) {
        moveField(draggedId, hoverId, draggedSection, hoverSection);
        item.id = hoverId; // Update dragged item's id
        item.section = hoverSection; // Update dragged item's section
        return;
      }

      // Time to actually perform the action for same-section moves
      moveField(draggedId, hoverId, draggedSection, hoverSection);

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations, but it's okay here for the sake of performance
      // to avoid expensive index searches.
      item.id = hoverId;
      item.section = hoverSection;
    },
  }));

  drag(drop(ref));

  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}
      className={`flex items-center justify-between p-2 bg-gray-50 rounded ${field.width === 'full' ? 'col-span-2' : ''}`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={field.is_visible}
          onChange={(e) => {
            onUpdateFieldProperty(field.id, 'is_visible', e.target.checked);
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
            onUpdateFieldProperty(field.id, 'width', e.target.value as 'full' | 'half');
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
            onUpdateFieldProperty(field.id, 'is_required', e.target.checked);
          }}
          title="Required field"
        />
        <span className="text-xs text-gray-500">Req</span>
        {!checkIsSystemField(field.api_name) && ( // Use passed prop to check system field status
          <button
            className="text-blue-500 hover:text-blue-700 p-1"
            title="Edit layout for field"
            onClick={() => handleEditField(field)}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.232z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default FieldDragItem; 