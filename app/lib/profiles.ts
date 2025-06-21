import { supabase } from './supabase';
import {
    Profile,
    PermissionSet,
    ObjectPermission,
    FieldPermission,
    ProfileWithPermissions,
    PermissionSetWithDetails,
    CreateProfileInput,
    CreatePermissionSetInput,
    UpdateProfileInput,
    UpdatePermissionSetInput
} from '../types/profile';

// Profile operations
export const getProfiles = async (): Promise<Profile[]> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

    if (error) throw error;
    return data;
};

export const getProfile = async (id: string): Promise<ProfileWithPermissions> => {
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

    if (profileError) throw profileError;

    const { data: permissionSets, error: permissionSetsError } = await supabase
        .from('profile_permission_sets')
        .select(`
            permission_set_id,
            permission_sets (
                id,
                name,
                description,
                created_at,
                updated_at
            )
        `)
        .eq('profile_id', id);

    if (permissionSetsError) throw permissionSetsError;

    return {
        ...profile,
        permission_sets: permissionSets.map((ps: { permission_sets: PermissionSet }) => ps.permission_sets)
    };
};

export const createProfile = async (input: CreateProfileInput): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .insert([input])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateProfile = async (input: UpdateProfileInput): Promise<Profile> => {
    const { id, ...updateData } = input;
    const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteProfile = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

// Permission set operations
export const getPermissionSets = async (): Promise<PermissionSet[]> => {
    const { data, error } = await supabase
        .from('permission_sets')
        .select('*')
        .order('name');

    if (error) throw error;
    return data;
};

export const getPermissionSet = async (id: string): Promise<PermissionSetWithDetails> => {
    const { data: permissionSet, error: permissionSetError } = await supabase
        .from('permission_sets')
        .select('*')
        .eq('id', id)
        .single();

    if (permissionSetError) throw permissionSetError;

    const { data: objectPermissions, error: objectPermissionsError } = await supabase
        .from('object_permissions')
        .select('*')
        .eq('permission_set_id', id);

    if (objectPermissionsError) throw objectPermissionsError;

    const { data: fieldPermissions, error: fieldPermissionsError } = await supabase
        .from('field_permissions')
        .select('*')
        .eq('permission_set_id', id);

    if (fieldPermissionsError) throw fieldPermissionsError;

    return {
        ...permissionSet,
        object_permissions: objectPermissions,
        field_permissions: fieldPermissions
    };
};

export const createPermissionSet = async (input: CreatePermissionSetInput): Promise<PermissionSetWithDetails> => {
    const { object_permissions, field_permissions, ...permissionSetData } = input;

    // Start a transaction
    const { data: permissionSet, error: permissionSetError } = await supabase
        .from('permission_sets')
        .insert([permissionSetData])
        .select()
        .single();

    if (permissionSetError) throw permissionSetError;

    // Insert object permissions if provided
    if (object_permissions?.length) {
        const { error: objectPermissionsError } = await supabase
            .from('object_permissions')
            .insert(
                object_permissions.map(op => ({
                    ...op,
                    permission_set_id: permissionSet.id
                }))
            );

        if (objectPermissionsError) throw objectPermissionsError;
    }

    // Insert field permissions if provided
    if (field_permissions?.length) {
        const { error: fieldPermissionsError } = await supabase
            .from('field_permissions')
            .insert(
                field_permissions.map(fp => ({
                    ...fp,
                    permission_set_id: permissionSet.id
                }))
            );

        if (fieldPermissionsError) throw fieldPermissionsError;
    }

    return getPermissionSet(permissionSet.id);
};

export const updatePermissionSet = async (input: UpdatePermissionSetInput): Promise<PermissionSetWithDetails> => {
    const { id, object_permissions, field_permissions, ...permissionSetData } = input;

    // Update permission set
    const { error: permissionSetError } = await supabase
        .from('permission_sets')
        .update(permissionSetData)
        .eq('id', id);

    if (permissionSetError) throw permissionSetError;

    // Update object permissions if provided
    if (object_permissions) {
        // Delete existing object permissions
        const { error: deleteError } = await supabase
            .from('object_permissions')
            .delete()
            .eq('permission_set_id', id);

        if (deleteError) throw deleteError;

        // Insert new object permissions
        if (object_permissions.length) {
            const { error: insertError } = await supabase
                .from('object_permissions')
                .insert(
                    object_permissions.map(op => ({
                        ...op,
                        permission_set_id: id
                    }))
                );

            if (insertError) throw insertError;
        }
    }

    // Update field permissions if provided
    if (field_permissions) {
        // Delete existing field permissions
        const { error: deleteError } = await supabase
            .from('field_permissions')
            .delete()
            .eq('permission_set_id', id);

        if (deleteError) throw deleteError;

        // Insert new field permissions
        if (field_permissions.length) {
            const { error: insertError } = await supabase
                .from('field_permissions')
                .insert(
                    field_permissions.map(fp => ({
                        ...fp,
                        permission_set_id: id
                    }))
                );

            if (insertError) throw insertError;
        }
    }

    return getPermissionSet(id);
};

export const deletePermissionSet = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('permission_sets')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

// Profile-Permission Set operations
export const assignPermissionSetToProfile = async (profileId: string, permissionSetId: string): Promise<void> => {
    const { error } = await supabase
        .from('profile_permission_sets')
        .insert([{
            profile_id: profileId,
            permission_set_id: permissionSetId
        }]);

    if (error) throw error;
};

export const removePermissionSetFromProfile = async (profileId: string, permissionSetId: string): Promise<void> => {
    const { error } = await supabase
        .from('profile_permission_sets')
        .delete()
        .match({
            profile_id: profileId,
            permission_set_id: permissionSetId
        });

    if (error) throw error;
};

// Permission check functions
export const checkObjectPermission = async (
    userId: string,
    objectName: string,
    permissionType: 'create' | 'read' | 'update' | 'delete'
): Promise<boolean> => {
    const { data, error } = await supabase
        .rpc('check_object_permission', {
            p_user_id: userId,
            p_object_name: objectName,
            p_permission_type: permissionType
        });

    if (error) throw error;
    return data;
};

export const checkFieldPermission = async (
    userId: string,
    objectName: string,
    fieldName: string,
    permissionType: 'read' | 'edit'
): Promise<boolean> => {
    const { data, error } = await supabase
        .rpc('check_field_permission', {
            p_user_id: userId,
            p_object_name: objectName,
            p_field_name: fieldName,
            p_permission_type: permissionType
        });

    if (error) throw error;
    return data;
}; 