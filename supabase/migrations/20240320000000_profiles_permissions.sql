-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create permission_sets table
CREATE TABLE IF NOT EXISTS permission_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create object_permissions table to store object-level permissions
CREATE TABLE IF NOT EXISTS object_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    can_create BOOLEAN DEFAULT false,
    can_read BOOLEAN DEFAULT false,
    can_update BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(permission_set_id, object_name)
);

-- Create field_permissions table to store field-level permissions
CREATE TABLE IF NOT EXISTS field_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
    object_name VARCHAR(255) NOT NULL,
    field_name VARCHAR(255) NOT NULL,
    can_read BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(permission_set_id, object_name, field_name)
);

-- Create profile_permission_sets table to link profiles with permission sets
CREATE TABLE IF NOT EXISTS profile_permission_sets (
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    permission_set_id UUID REFERENCES permission_sets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (profile_id, permission_set_id)
);

-- Add profile_id to users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'profile_id'
    ) THEN
        ALTER TABLE users ADD COLUMN profile_id UUID REFERENCES profiles(id);
    END IF;
END $$;

-- Create function to check object permissions
CREATE OR REPLACE FUNCTION check_object_permission(
    p_user_id UUID,
    p_object_name VARCHAR,
    p_permission_type VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN profiles p ON u.profile_id = p.id
        JOIN profile_permission_sets pps ON p.id = pps.profile_id
        JOIN permission_sets ps ON pps.permission_set_id = ps.id
        JOIN object_permissions op ON ps.id = op.permission_set_id
        WHERE u.id = p_user_id
        AND op.object_name = p_object_name
        AND CASE p_permission_type
            WHEN 'create' THEN op.can_create
            WHEN 'read' THEN op.can_read
            WHEN 'update' THEN op.can_update
            WHEN 'delete' THEN op.can_delete
            ELSE false
        END
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check field permissions
CREATE OR REPLACE FUNCTION check_field_permission(
    p_user_id UUID,
    p_object_name VARCHAR,
    p_field_name VARCHAR,
    p_permission_type VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN profiles p ON u.profile_id = p.id
        JOIN profile_permission_sets pps ON p.id = pps.profile_id
        JOIN permission_sets ps ON pps.permission_set_id = ps.id
        JOIN field_permissions fp ON ps.id = fp.permission_set_id
        WHERE u.id = p_user_id
        AND fp.object_name = p_object_name
        AND fp.field_name = p_field_name
        AND CASE p_permission_type
            WHEN 'read' THEN fp.can_read
            WHEN 'edit' THEN fp.can_edit
            ELSE false
        END
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_permission_sets ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Profiles are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Profiles are viewable by authenticated users"
            ON profiles FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Profiles are manageable by admins'
    ) THEN
        CREATE POLICY "Profiles are manageable by admins"
            ON profiles FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;
END $$;

-- Permission sets policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'permission_sets' 
        AND policyname = 'Permission sets are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Permission sets are viewable by authenticated users"
            ON permission_sets FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'permission_sets' 
        AND policyname = 'Permission sets are manageable by admins'
    ) THEN
        CREATE POLICY "Permission sets are manageable by admins"
            ON permission_sets FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;
END $$;

-- Object permissions policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'object_permissions' 
        AND policyname = 'Object permissions are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Object permissions are viewable by authenticated users"
            ON object_permissions FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'object_permissions' 
        AND policyname = 'Object permissions are manageable by admins'
    ) THEN
        CREATE POLICY "Object permissions are manageable by admins"
            ON object_permissions FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;
END $$;

-- Field permissions policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'field_permissions' 
        AND policyname = 'Field permissions are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Field permissions are viewable by authenticated users"
            ON field_permissions FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'field_permissions' 
        AND policyname = 'Field permissions are manageable by admins'
    ) THEN
        CREATE POLICY "Field permissions are manageable by admins"
            ON field_permissions FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;
END $$;

-- Profile permission sets policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profile_permission_sets' 
        AND policyname = 'Profile permission sets are viewable by authenticated users'
    ) THEN
        CREATE POLICY "Profile permission sets are viewable by authenticated users"
            ON profile_permission_sets FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profile_permission_sets' 
        AND policyname = 'Profile permission sets are manageable by admins'
    ) THEN
        CREATE POLICY "Profile permission sets are manageable by admins"
            ON profile_permission_sets FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE id = auth.uid()
                    AND role = 'admin'
                )
            );
    END IF;
END $$; 