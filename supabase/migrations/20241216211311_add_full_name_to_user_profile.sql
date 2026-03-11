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

-- migration_name: add_full_name_to_profiles
-- description: Adds a new column "full_name" to the "profiles" table in the "public" schema
DO $$ BEGIN -- Check if the column "full_name" already exists in the "profiles" table
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'full_name'
) THEN -- Add the "full_name" column to the "profiles" table
ALTER TABLE public.profiles
ADD COLUMN full_name varchar(255);
RAISE NOTICE 'Added full_name column to profiles table';
ELSE RAISE NOTICE 'full_name column already exists in profiles table';
END IF;
END $$;