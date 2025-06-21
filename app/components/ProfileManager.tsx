'use client';

import React, { useState, useEffect } from 'react';
import {
    Profile,
    PermissionSet,
    ObjectPermission,
    FieldPermission,
    CreateProfileInput,
    CreatePermissionSetInput
} from '../types/profile';
import {
    getProfiles,
    getPermissionSets,
    createProfile,
    updateProfile,
    deleteProfile,
    createPermissionSet,
    updatePermissionSet,
    deletePermissionSet,
    assignPermissionSetToProfile,
    removePermissionSetFromProfile
} from '../lib/profiles';
import PermissionSetEditor from './PermissionSetEditor';

export default function ProfileManager() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [selectedPermissionSet, setSelectedPermissionSet] = useState<PermissionSet | null>(null);
    const [showCreateProfile, setShowCreateProfile] = useState(false);
    const [showCreatePermissionSet, setShowCreatePermissionSet] = useState(false);
    const [newProfile, setNewProfile] = useState<CreateProfileInput>({ name: '', description: '' });
    const [newPermissionSet, setNewPermissionSet] = useState<CreatePermissionSetInput>({
        name: '',
        description: '',
        object_permissions: [],
        field_permissions: []
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [showPermissionSetEditor, setShowPermissionSetEditor] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [profilesData, permissionSetsData] = await Promise.all([
                getProfiles(),
                getPermissionSets()
            ]);
            setProfiles(profilesData);
            setPermissionSets(permissionSetsData);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleCreateProfile = async () => {
        try {
            if (!newProfile.name.trim()) {
                setMessage('❌ Profile name is required');
                return;
            }

            const profile = await createProfile(newProfile);
            setProfiles([...profiles, profile]);
            setShowCreateProfile(false);
            setNewProfile({ name: '', description: '' });
            setMessage('✅ Profile created successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleCreatePermissionSet = async () => {
        try {
            if (!newPermissionSet.name.trim()) {
                setMessage('❌ Permission set name is required');
                return;
            }

            const permissionSet = await createPermissionSet(newPermissionSet);
            setPermissionSets([...permissionSets, permissionSet]);
            setShowCreatePermissionSet(false);
            setNewPermissionSet({
                name: '',
                description: '',
                object_permissions: [],
                field_permissions: []
            });
            setMessage('✅ Permission set created successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        if (!confirm('Are you sure you want to delete this profile?')) return;

        try {
            await deleteProfile(profileId);
            setProfiles(profiles.filter(p => p.id !== profileId));
            setMessage('✅ Profile deleted successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDeletePermissionSet = async (permissionSetId: string) => {
        if (!confirm('Are you sure you want to delete this permission set?')) return;

        try {
            await deletePermissionSet(permissionSetId);
            setPermissionSets(permissionSets.filter(ps => ps.id !== permissionSetId));
            setMessage('✅ Permission set deleted successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleAssignPermissionSet = async (profileId: string, permissionSetId: string) => {
        try {
            await assignPermissionSetToProfile(profileId, permissionSetId);
            setMessage('✅ Permission set assigned successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleRemovePermissionSet = async (profileId: string, permissionSetId: string) => {
        try {
            await removePermissionSetFromProfile(profileId, permissionSetId);
            setMessage('✅ Permission set removed successfully!');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleEditPermissionSet = (permissionSet: PermissionSet) => {
        setSelectedPermissionSet(permissionSet);
        setShowPermissionSetEditor(true);
    };

    const handlePermissionSetUpdate = (updatedPermissionSet: PermissionSet) => {
        setPermissionSets(permissionSets.map(ps =>
            ps.id === updatedPermissionSet.id ? updatedPermissionSet : ps
        ));
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Profile & Permission Management</h1>
                <div className="space-x-4">
                    <button
                        onClick={() => setShowCreateProfile(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Create Profile
                    </button>
                    <button
                        onClick={() => setShowCreatePermissionSet(true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                        Create Permission Set
                    </button>
                </div>
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
                {/* Profiles Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Profiles</h2>
                    <div className="space-y-4">
                        {profiles.map(profile => (
                            <div
                                key={profile.id}
                                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-gray-900">{profile.name}</h3>
                                        <p className="text-sm text-gray-500">{profile.description}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => setSelectedProfile(profile)}
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

                {/* Permission Sets Section */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">Permission Sets</h2>
                    <div className="space-y-4">
                        {permissionSets.map(permissionSet => (
                            <div
                                key={permissionSet.id}
                                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-medium text-gray-900">{permissionSet.name}</h3>
                                        <p className="text-sm text-gray-500">{permissionSet.description}</p>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleEditPermissionSet(permissionSet)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeletePermissionSet(permissionSet.id)}
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
            </div>

            {/* Create Profile Modal */}
            {showCreateProfile && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900">Create New Profile</h3>
                            <div className="mt-2 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        value={newProfile.name}
                                        onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        value={newProfile.description}
                                        onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowCreateProfile(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateProfile}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Permission Set Modal */}
            {showCreatePermissionSet && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3">
                            <h3 className="text-lg font-medium text-gray-900">Create New Permission Set</h3>
                            <div className="mt-2 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        value={newPermissionSet.name}
                                        onChange={(e) => setNewPermissionSet({ ...newPermissionSet, name: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        value={newPermissionSet.description}
                                        onChange={(e) => setNewPermissionSet({ ...newPermissionSet, description: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowCreatePermissionSet(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreatePermissionSet}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Permission Set Editor Modal */}
            {showPermissionSetEditor && selectedPermissionSet && (
                <PermissionSetEditor
                    permissionSet={selectedPermissionSet}
                    onClose={() => {
                        setShowPermissionSetEditor(false);
                        setSelectedPermissionSet(null);
                    }}
                    onUpdate={handlePermissionSetUpdate}
                />
            )}
        </div>
    );
} 