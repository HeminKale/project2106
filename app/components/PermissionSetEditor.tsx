'use client';

import React, { useState, useEffect } from 'react';
import {
    PermissionSet,
    ObjectPermission,
    FieldPermission,
    UpdatePermissionSetInput
} from '../types/profile';
import { updatePermissionSet } from '../lib/profiles';

interface PermissionSetEditorProps {
    permissionSet: PermissionSet;
    onClose: () => void;
    onUpdate: (updatedPermissionSet: PermissionSet) => void;
}

export default function PermissionSetEditor({
    permissionSet,
    onClose,
    onUpdate
}: PermissionSetEditorProps) {
    const [objectPermissions, setObjectPermissions] = useState<ObjectPermission[]>([]);
    const [fieldPermissions, setFieldPermissions] = useState<FieldPermission[]>([]);
    const [selectedObject, setSelectedObject] = useState<string>('');
    const [selectedField, setSelectedField] = useState<string>('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (permissionSet) {
            setObjectPermissions(permissionSet.object_permissions || []);
            setFieldPermissions(permissionSet.field_permissions || []);
        }
    }, [permissionSet]);

    const handleUpdateObjectPermission = async (
        objectName: string,
        permissionType: 'create' | 'read' | 'update' | 'delete',
        value: boolean
    ) => {
        try {
            const updatedPermissions = objectPermissions.map(op =>
                op.object_name === objectName
                    ? { ...op, [permissionType]: value }
                    : op
            );

            const input: UpdatePermissionSetInput = {
                id: permissionSet.id,
                object_permissions: updatedPermissions
            };

            const updated = await updatePermissionSet(input);
            setObjectPermissions(updated.object_permissions);
            onUpdate(updated);
            setMessage('✅ Object permissions updated successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleUpdateFieldPermission = async (
        objectName: string,
        fieldName: string,
        permissionType: 'read' | 'edit',
        value: boolean
    ) => {
        try {
            const updatedPermissions = fieldPermissions.map(fp =>
                fp.object_name === objectName && fp.field_name === fieldName
                    ? { ...fp, [permissionType]: value }
                    : fp
            );

            const input: UpdatePermissionSetInput = {
                id: permissionSet.id,
                field_permissions: updatedPermissions
            };

            const updated = await updatePermissionSet(input);
            setFieldPermissions(updated.field_permissions);
            onUpdate(updated);
            setMessage('✅ Field permissions updated successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAddObjectPermission = async () => {
        if (!selectedObject) {
            setMessage('❌ Please select an object');
            return;
        }

        try {
            const newPermission: ObjectPermission = {
                id: '', // Will be set by the database
                permission_set_id: permissionSet.id,
                object_name: selectedObject,
                can_create: false,
                can_read: false,
                can_update: false,
                can_delete: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const input: UpdatePermissionSetInput = {
                id: permissionSet.id,
                object_permissions: [...objectPermissions, newPermission]
            };

            const updated = await updatePermissionSet(input);
            setObjectPermissions(updated.object_permissions);
            onUpdate(updated);
            setSelectedObject('');
            setMessage('✅ Object permission added successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAddFieldPermission = async () => {
        if (!selectedObject || !selectedField) {
            setMessage('❌ Please select both object and field');
            return;
        }

        try {
            const newPermission: FieldPermission = {
                id: '', // Will be set by the database
                permission_set_id: permissionSet.id,
                object_name: selectedObject,
                field_name: selectedField,
                can_read: false,
                can_edit: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const input: UpdatePermissionSetInput = {
                id: permissionSet.id,
                field_permissions: [...fieldPermissions, newPermission]
            };

            const updated = await updatePermissionSet(input);
            setFieldPermissions(updated.field_permissions);
            onUpdate(updated);
            setSelectedObject('');
            setSelectedField('');
            setMessage('✅ Field permission added successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
            <div className="relative top-20 mx-auto p-5 border w-3/4 shadow-lg rounded-md bg-white">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                        Edit Permission Set: {permissionSet.name}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        ✕
                    </button>
                </div>

                {message && (
                    <div className="mb-4 p-4 rounded-md bg-green-50 text-green-700">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-4 rounded-md bg-red-50 text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Object Permissions */}
                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-4">Object Permissions</h4>
                        <div className="space-y-4">
                            {objectPermissions.map(permission => (
                                <div
                                    key={`${permission.object_name}`}
                                    className="border rounded-lg p-4"
                                >
                                    <h5 className="font-medium text-gray-900 mb-2">
                                        {permission.object_name}
                                    </h5>
                                    <div className="space-y-2">
                                        {(['create', 'read', 'update', 'delete'] as const).map(type => (
                                            <label key={type} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={permission[`can_${type}`]}
                                                    onChange={(e) => handleUpdateObjectPermission(
                                                        permission.object_name,
                                                        type,
                                                        e.target.checked
                                                    )}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    Can {type}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="border rounded-lg p-4">
                                <h5 className="font-medium text-gray-900 mb-2">Add New Object Permission</h5>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Object Name
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedObject}
                                            onChange={(e) => setSelectedObject(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddObjectPermission}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Add Object Permission
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Field Permissions */}
                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-4">Field Permissions</h4>
                        <div className="space-y-4">
                            {fieldPermissions.map(permission => (
                                <div
                                    key={`${permission.object_name}-${permission.field_name}`}
                                    className="border rounded-lg p-4"
                                >
                                    <h5 className="font-medium text-gray-900 mb-2">
                                        {permission.object_name}.{permission.field_name}
                                    </h5>
                                    <div className="space-y-2">
                                        {(['read', 'edit'] as const).map(type => (
                                            <label key={type} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={permission[`can_${type}`]}
                                                    onChange={(e) => handleUpdateFieldPermission(
                                                        permission.object_name,
                                                        permission.field_name,
                                                        type,
                                                        e.target.checked
                                                    )}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">
                                                    Can {type}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="border rounded-lg p-4">
                                <h5 className="font-medium text-gray-900 mb-2">Add New Field Permission</h5>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Object Name
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedObject}
                                            onChange={(e) => setSelectedObject(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Field Name
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedField}
                                            onChange={(e) => setSelectedField(e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddFieldPermission}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Add Field Permission
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 