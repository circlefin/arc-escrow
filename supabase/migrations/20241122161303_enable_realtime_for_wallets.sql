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

-- migration_name: enable_realtime_for_wallets
-- description: Enables Realtime for the "wallets" table in the "public" schema

DO $$
BEGIN
  -- Check if the wallets table is already part of the supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wallets'
  ) THEN
    -- Add the wallets table to the supabase_realtime publication
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
    RAISE NOTICE 'Added public.wallets to publication supabase_realtime';
  ELSE
    RAISE NOTICE 'public.wallets is already part of publication supabase_realtime';
  END IF;
END $$;
