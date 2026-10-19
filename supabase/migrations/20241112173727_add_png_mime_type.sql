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
DECLARE
  v_bucket_exists boolean;
BEGIN
 SELECT EXISTS (
   SELECT 1 FROM storage.buckets WHERE id = 'agreement-documents'
 ) INTO v_bucket_exists;

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
    10485760,
    ARRAY[
      'image/png',
      'image/jpeg',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types
    WHERE buckets.file_size_limit IS DISTINCT FROM EXCLUDED.file_size_limit
    OR buckets.allowed_mime_types IS DISTINCT FROM EXCLUDED.allowed_mime_types;

  RAISE NOTICE 'Bucket agreement-documents configuration updated';
END $$;
