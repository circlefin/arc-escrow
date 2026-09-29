-- Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

CREATE TEMP TABLE temp_profiles AS SELECT * FROM profiles;

ALTER TABLE wallets
DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

ALTER TABLE transactions
DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE dispute_resolutions
DROP CONSTRAINT IF EXISTS dispute_resolutions_resolver_user_id_fkey;

DROP INDEX IF EXISTS idx_wallets_user_id;
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_dispute_resolutions_resolver_user_id;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

DROP TABLE profiles;

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID NOT NULL REFERENCES auth.users(id),
    name VARCHAR NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(auth_user_id)
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE 
    display_name TEXT;
    new_profile_id UUID;
BEGIN
    display_name := COALESCE(
        (NEW.raw_user_meta_data->>'full_name'),
        split_part(NEW.email, '@', 1),
        NEW.email
    );
    
    BEGIN
        INSERT INTO public.profiles (auth_user_id, name)
        VALUES (NEW.id, display_name)
        RETURNING id INTO new_profile_id;

        RAISE LOG 'Created profile % for auth user %', new_profile_id, NEW.id;
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
    END;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

INSERT INTO profiles (id, auth_user_id, name, avatar_url, created_at, updated_at, is_active)
SELECT 
    uuid_generate_v4(),
    id,
    name,
    avatar_url,
    created_at,
    updated_at,
    is_active
FROM temp_profiles;

CREATE TEMP TABLE id_mappings AS
SELECT 
    old_profiles.id as old_id,
    new_profiles.id as new_id
FROM temp_profiles old_profiles
JOIN profiles new_profiles ON new_profiles.auth_user_id = old_profiles.id;

ALTER TABLE wallets
RENAME COLUMN user_id TO profile_id;

UPDATE wallets w
SET profile_id = m.new_id
FROM id_mappings m
WHERE w.profile_id = m.old_id::uuid;

ALTER TABLE transactions
RENAME COLUMN user_id TO profile_id;

UPDATE transactions t
SET profile_id = m.new_id
FROM id_mappings m
WHERE t.profile_id = m.old_id::uuid;

ALTER TABLE dispute_resolutions
RENAME COLUMN resolver_user_id TO resolver_profile_id;

UPDATE dispute_resolutions dr
SET resolver_profile_id = m.new_id
FROM id_mappings m
WHERE dr.resolver_profile_id = m.old_id::uuid;

ALTER TABLE wallets
ADD CONSTRAINT wallets_profile_id_fkey 
    FOREIGN KEY (profile_id) 
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE transactions
ADD CONSTRAINT transactions_profile_id_fkey 
    FOREIGN KEY (profile_id) 
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE dispute_resolutions
ADD CONSTRAINT dispute_resolutions_resolver_profile_id_fkey 
    FOREIGN KEY (resolver_profile_id) 
    REFERENCES profiles(id)
    ON DELETE CASCADE;

CREATE INDEX idx_wallets_profile_id ON wallets(profile_id);
CREATE INDEX idx_transactions_profile_id ON transactions(profile_id);
CREATE INDEX idx_dispute_resolutions_resolver_profile_id ON dispute_resolutions(resolver_profile_id);

CREATE OR REPLACE FUNCTION handle_profile_picture_update()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE profiles
        SET avatar_url = NEW.name
        WHERE auth_user_id::text = storage.foldername(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TABLE IF EXISTS temp_profiles;
DROP TABLE IF EXISTS id_mappings;

COMMENT ON TABLE profiles IS 'Modified to use its own UUID as primary key with auth_user_id as foreign key to auth.users';
COMMENT ON COLUMN profiles.id IS 'Primary key UUID for the profile';
COMMENT ON COLUMN profiles.auth_user_id IS 'Foreign key reference to auth.users table';