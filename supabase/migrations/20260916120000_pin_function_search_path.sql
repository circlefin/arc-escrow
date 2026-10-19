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

-- Pin search_path on trigger functions (advisor lint 0011_function_search_path_mutable)
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.storage_folder_structure() SET search_path = '';

CREATE OR REPLACE FUNCTION public.handle_profile_picture_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE public.profiles
        SET avatar_url = NEW.name
        WHERE auth_user_id::text = storage.foldername(NEW.name);
    END IF;
    RETURN NEW;
END;
$$;
