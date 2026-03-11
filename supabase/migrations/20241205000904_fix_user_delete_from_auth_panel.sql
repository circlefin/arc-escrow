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

-- First, we need to drop the existing unique constraint which includes the foreign key
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_auth_user_id_key;

-- Then drop the foreign key constraint itself
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_auth_user_id_fkey;

-- Add back the foreign key constraint with ON DELETE CASCADE
ALTER TABLE profiles
ADD CONSTRAINT profiles_auth_user_id_fkey 
    FOREIGN KEY (auth_user_id) 
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Re-add the unique constraint
ALTER TABLE profiles
ADD CONSTRAINT profiles_auth_user_id_key 
    UNIQUE (auth_user_id);

-- Add comment to document the change
COMMENT ON CONSTRAINT profiles_auth_user_id_fkey ON profiles IS 'Foreign key reference to auth.users table with CASCADE DELETE enabled';