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

-- migration_name: allow_null_circle_transaction_id
-- description: Allows the "circle_transaction_id" column in the "transactions" table to be nullable.

DO $$
BEGIN
  -- Check if the "circle_transaction_id" column is already nullable
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'circle_transaction_id'
      AND is_nullable = 'NO'
  ) THEN
    -- Alter the "circle_transaction_id" column to allow NULL values
    ALTER TABLE public.transactions
    ALTER COLUMN circle_transaction_id DROP NOT NULL;

    RAISE NOTICE 'Updated "circle_transaction_id" column to allow NULL values';
  ELSE
    RAISE NOTICE '"circle_transaction_id" column is already nullable';
  END IF;
END $$;
