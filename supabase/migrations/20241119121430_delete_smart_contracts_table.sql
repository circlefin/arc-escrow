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

-- migration_name: delete_smart_contracts_table
-- description: Deletes the "smart_contracts" table from the "public" schema

DO $$
BEGIN
  -- Check if the "smart_contracts" table exists in the "public" schema
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'smart_contracts'
  ) THEN
    -- Drop the "smart_contracts" table
    DROP TABLE public.smart_contracts;

    RAISE NOTICE 'Deleted smart_contracts table from public schema';
  ELSE
    RAISE NOTICE 'smart_contracts table does not exist in public schema';
  END IF;
END $$;
