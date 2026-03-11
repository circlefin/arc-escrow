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

-- Enable storage extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add avatar_url column to profiles if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES
    ('profile-pictures', 'profile-pictures', false, false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif']),
    ('agreement-documents', 'agreement-documents', false, false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
    ('dispute-evidence', 'dispute-evidence', false, false, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png', 'video/mp4'])
ON CONFLICT (id) DO UPDATE
SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist (to avoid conflicts on rerun)
DROP POLICY IF EXISTS "Give users read access to profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to upload their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view their agreement documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to upload agreement documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to view dispute evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to upload dispute evidence" ON storage.objects;

-- Profile Pictures bucket policies
CREATE POLICY "Give users read access to profile pictures"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'profile-pictures' AND
    (auth.uid() = (NULLIF(storage.foldername(name)::text, '')::uuid))
);

CREATE POLICY "Allow users to upload their own profile picture"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'profile-pictures' AND
    (auth.uid() = (NULLIF(storage.foldername(name)::text, '')::uuid)) AND
    (storage.extension(name) = 'jpg' OR
     storage.extension(name) = 'jpeg' OR
     storage.extension(name) = 'png' OR
     storage.extension(name) = 'gif')
);

CREATE POLICY "Allow users to update their own profile picture"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'profile-pictures' AND
    (auth.uid() = (NULLIF(storage.foldername(name)::text, '')::uuid))
);

CREATE POLICY "Allow users to delete their own profile picture"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'profile-pictures' AND
    (auth.uid() = (NULLIF(storage.foldername(name)::text, '')::uuid))
);

-- Agreement Documents bucket policies
CREATE POLICY "Allow users to view their agreement documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'agreement-documents' AND
    EXISTS (
        SELECT 1 FROM escrow_agreements ea
        JOIN wallets w ON (w.id = ea.beneficiary_wallet_id OR w.id = ea.depositor_wallet_id)
        WHERE w.user_id = auth.uid()
        AND storage.foldername(name)::text = ea.id::text
    )
);

CREATE POLICY "Allow users to upload agreement documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'agreement-documents' AND
    EXISTS (
        SELECT 1 FROM escrow_agreements ea
        JOIN wallets w ON (w.id = ea.beneficiary_wallet_id OR w.id = ea.depositor_wallet_id)
        WHERE w.user_id = auth.uid()
        AND storage.foldername(name)::text = ea.id::text
    )
);

-- Dispute Evidence bucket policies
CREATE POLICY "Allow users to view dispute evidence"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'dispute-evidence' AND
    EXISTS (
        SELECT 1 FROM dispute_resolutions dr
        JOIN escrow_agreements ea ON ea.id = dr.escrow_agreement_id
        JOIN wallets w ON (w.id = ea.beneficiary_wallet_id OR w.id = ea.depositor_wallet_id)
        WHERE w.user_id = auth.uid()
        AND storage.foldername(name)::text = dr.id::text
    )
);

CREATE POLICY "Allow users to upload dispute evidence"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'dispute-evidence' AND
    EXISTS (
        SELECT 1 FROM dispute_resolutions dr
        JOIN escrow_agreements ea ON ea.id = dr.escrow_agreement_id
        JOIN wallets w ON (w.id = ea.beneficiary_wallet_id OR w.id = ea.depositor_wallet_id)
        WHERE w.user_id = auth.uid()
        AND storage.foldername(name)::text = dr.id::text
    )
);

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS on_profile_picture_change ON storage.objects;
DROP TRIGGER IF EXISTS enforce_storage_structure ON storage.objects;
DROP FUNCTION IF EXISTS handle_profile_picture_update();
DROP FUNCTION IF EXISTS storage_folder_structure();

-- Helper function to handle profile picture updates
CREATE OR REPLACE FUNCTION handle_profile_picture_update()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE profiles
        SET avatar_url = NEW.name
        WHERE id::text = storage.foldername(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Helper function to ensure proper folder structure
CREATE OR REPLACE FUNCTION storage_folder_structure()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.bucket_id = 'profile-pictures' THEN
        IF storage.foldername(NEW.name) IS NULL THEN
            NEW.name := auth.uid() || '/' || NEW.name;
        END IF;
    ELSIF NEW.bucket_id = 'agreement-documents' THEN
        IF storage.foldername(NEW.name) IS NULL THEN
            RAISE EXCEPTION 'Agreement documents must be placed in an agreement folder';
        END IF;
    ELSIF NEW.bucket_id = 'dispute-evidence' THEN
        IF storage.foldername(NEW.name) IS NULL THEN
            RAISE EXCEPTION 'Dispute evidence must be placed in a dispute folder';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER on_profile_picture_change
    AFTER INSERT OR UPDATE ON storage.objects
    FOR EACH ROW
    WHEN (NEW.bucket_id = 'profile-pictures')
    EXECUTE FUNCTION handle_profile_picture_update();

CREATE TRIGGER enforce_storage_structure
    BEFORE INSERT ON storage.objects
    FOR EACH ROW
    EXECUTE FUNCTION storage_folder_structure();

-- Add comment to describe migration
COMMENT ON TABLE storage.objects IS 'Storage configuration added in migration 2. Contains bucket policies for profile pictures, agreement documents, and dispute evidence.';
