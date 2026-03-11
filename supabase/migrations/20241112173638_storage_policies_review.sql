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

-- migration_name: adjust_storage_policies_for_agreement_documents_with_temp
-- description: Update storage policies to handle temporary file uploads for agreements
BEGIN;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE 
  policy_name text;
  v_count int := 0;
BEGIN 
  -- Count existing policies for logging
  SELECT COUNT(*) INTO v_count
  FROM pg_policies 
  WHERE tablename = 'objects' AND schemaname = 'storage';

  RAISE NOTICE 'Found % policies to remove', v_count;

  FOR policy_name IN (
    SELECT pol.policyname
    FROM pg_policies pol
    WHERE pol.tablename = 'objects' AND pol.schemaname = 'storage'
  ) LOOP
    RAISE NOTICE 'Dropping policy: %', policy_name;
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to clean up policies: %', SQLERRM;
END $$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
COMMIT;
-- Create new simplified policies
-- Policy for uploads (both temp and final locations)
CREATE POLICY "Enable upload for authenticated users" ON storage.objects FOR
INSERT WITH CHECK (
        bucket_id = 'agreement-documents'
        AND auth.role() = 'authenticated'
    );
-- Policy for reading files
CREATE POLICY "Enable read for authenticated users" ON storage.objects FOR
SELECT USING (
        bucket_id = 'agreement-documents'
        AND auth.role() = 'authenticated'
    );
-- Policy for deleting temp files
CREATE POLICY "Enable delete for authenticated users" ON storage.objects FOR DELETE USING (
    bucket_id = 'agreement-documents'
    AND auth.role() = 'authenticated'
);
-- Policy for updates
CREATE POLICY "Enable update for authenticated users" ON storage.objects FOR
UPDATE USING (
        bucket_id = 'agreement-documents'
        AND auth.role() = 'authenticated'
    ) WITH CHECK (
        bucket_id = 'agreement-documents'
        AND auth.role() = 'authenticated'
    );
DO $$
DECLARE
  v_bucket_exists boolean;
BEGIN
 -- Check if bucket exists
 SELECT EXISTS (
   SELECT 1 FROM storage.buckets WHERE id = 'agreement-documents'
 ) INTO v_bucket_exists;

 -- Log the operation
 RAISE NOTICE 'Bucket agreement-documents exists: %', v_bucket_exists;

  INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
  VALUES (
    'agreement-documents',
    'agreement-documents',
    false,
    10485760,  -- 10MB limit
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  )
  ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types
    WHERE buckets.file_size_limit IS DISTINCT FROM EXCLUDED.file_size_limit
    OR buckets.allowed_mime_types IS DISTINCT FROM EXCLUDED.allowed_mime_types;

  RAISE NOTICE 'Bucket agreement-documents configuration updated';
END $$;