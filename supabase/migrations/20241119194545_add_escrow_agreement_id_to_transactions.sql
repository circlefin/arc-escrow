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

-- migration_name: add_escrow_agreement_id_to_transactions
-- description: Adds a new column "escrow_agreement_id" to the "transactions" table and links it to the "id" column in the "escrow_agreements" table.

DO $$
BEGIN
  -- Check if the "escrow_agreement_id" column exists in the "transactions" table
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'escrow_agreement_id'
  ) THEN
    -- Add the "escrow_agreement_id" column to the "transactions" table
    ALTER TABLE public.transactions
    ADD COLUMN escrow_agreement_id uuid;

    -- Add a foreign key constraint linking "escrow_agreement_id" to the "id" column of "escrow_agreements"
    ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_escrow_agreement_id_fkey
    FOREIGN KEY (escrow_agreement_id)
    REFERENCES public.escrow_agreements (id)
    ON DELETE SET NULL;

    -- Optionally, create an index for the new column
    CREATE INDEX IF NOT EXISTS idx_transactions_escrow_agreement_id
    ON public.transactions USING btree (escrow_agreement_id);

    RAISE NOTICE 'Added "escrow_agreement_id" column to the "transactions" table and linked it to "escrow_agreements".';
  ELSE
    RAISE NOTICE '"escrow_agreement_id" column already exists in the "transactions" table.';
  END IF;
END $$;
