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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'escrow_agreements'
      AND column_name = 'circle_contract_id'
  ) THEN
    ALTER TABLE public.escrow_agreements
    ADD COLUMN circle_contract_id uuid;

    RAISE NOTICE 'Added circle_contract_id column to escrow_agreements table';
  ELSE
    RAISE NOTICE 'circle_contract_id column already exists in escrow_agreements table';
  END IF;
END $$;
