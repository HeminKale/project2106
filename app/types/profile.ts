export interface Profile {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface PermissionSet {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    object_permissions?: ObjectPermission[];
    field_permissions?: FieldPermission[];
}

export interface ObjectPermission {
    id: string;
    permission_set_id: string;
    object_name: string;
    can_create: boolean;
    can_read: boolean;
    can_update: boolean;
    can_delete: boolean;
    created_at: string;
    updated_at: string;
}

export interface FieldPermission {
    id: string;
    permission_set_id: string;
    object_name: string;
    field_name: string;
    can_read: boolean;
    can_edit: boolean;
    created_at: string;
    updated_at: string;
}

export interface ProfilePermissionSet {
    profile_id: string;
    permission_set_id: string;
    created_at: string;
}

export interface ProfileWithPermissions extends Profile {
    permission_sets: PermissionSet[];
}

export interface PermissionSetWithDetails extends PermissionSet {
    object_permissions: ObjectPermission[];
    field_permissions: FieldPermission[];
}

export interface CreateProfileInput {
    name: string;
    description?: string;
}

export interface CreatePermissionSetInput {
    name: string;
    description?: string;
    object_permissions?: {
        object_name: string;
        can_create: boolean;
        can_read: boolean;
        can_update: boolean;
        can_delete: boolean;
    }[];
    field_permissions?: {
        object_name: string;
        field_name: string;
        can_read: boolean;
        can_edit: boolean;
    }[];
}

export interface UpdateProfileInput extends Partial<CreateProfileInput> {
    id: string;
}

export interface UpdatePermissionSetInput extends Partial<CreatePermissionSetInput> {
    id: string;
} 