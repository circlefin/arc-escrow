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

-- migration_name: add_circle_contract_address_to_transactions
-- description: Adds a "circle_contract_address" column to the "transactions" table in the "public" schema

DO $$
BEGIN
  -- Check if the "circle_contract_address" column already exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'circle_contract_address'
  ) THEN
    -- Add the "circle_contract_address" column to the "transactions" table
    ALTER TABLE public.transactions
    ADD COLUMN circle_contract_address VARCHAR;
    RAISE NOTICE 'Added column "circle_contract_address" to table "public.transactions"';
  ELSE
    RAISE NOTICE 'Column "circle_contract_address" already exists in table "public.transactions"';
  END IF;
END $$;
