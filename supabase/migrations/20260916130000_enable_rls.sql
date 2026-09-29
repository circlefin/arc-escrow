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

-- Enable row level security on every public table (advisor lint 0013_rls_disabled_in_public).

-- Users reach these tables with the publishable key, so the policies scope them to their own rows. Secret-key writes bypass RLS.
-- Helpers live outside the exposed "public" schema so they can't be called over the API.
-- SECURITY DEFINER lets policies look across tables without recursing into each other's RLS.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT id FROM public.profiles WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION private.owns_wallet(p_wallet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.wallets w
        JOIN public.profiles p ON p.id = w.profile_id
        WHERE w.id = p_wallet_id
          AND p.auth_user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION private.is_agreement_party(p_agreement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.escrow_agreements a
        WHERE a.id = p_agreement_id
          AND (private.owns_wallet(a.depositor_wallet_id) OR private.owns_wallet(a.beneficiary_wallet_id))
    );
$$;

-- Agreements link their funding transaction through escrow_agreements.transaction_id, so this needs its own lookup.
CREATE OR REPLACE FUNCTION private.is_agreement_transaction_party(p_transaction_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.escrow_agreements a
        WHERE a.transaction_id = p_transaction_id
          AND (private.owns_wallet(a.depositor_wallet_id) OR private.owns_wallet(a.beneficiary_wallet_id))
    );
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- Profiles: any signed-in user can read them, only the owner can edit, and the handle_new_user trigger creates them.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth_user_id = (SELECT auth.uid()))
WITH CHECK (auth_user_id = (SELECT auth.uid()));

-- Wallets: readable by signed-in users, created and updated only with the secret key.
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wallets"
ON public.wallets FOR SELECT
TO authenticated
USING (true);

-- Escrow agreements: depositor and beneficiary can read and edit; only the depositor creates or deletes.
ALTER TABLE public.escrow_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view their agreements"
ON public.escrow_agreements FOR SELECT
TO authenticated
USING (
    private.owns_wallet(depositor_wallet_id)
    OR private.owns_wallet(beneficiary_wallet_id)
);

CREATE POLICY "Depositors can create agreements"
ON public.escrow_agreements FOR INSERT
TO authenticated
WITH CHECK (private.owns_wallet(depositor_wallet_id));

CREATE POLICY "Parties can update their agreements"
ON public.escrow_agreements FOR UPDATE
TO authenticated
USING (
    private.owns_wallet(depositor_wallet_id)
    OR private.owns_wallet(beneficiary_wallet_id)
)
WITH CHECK (
    private.owns_wallet(depositor_wallet_id)
    OR private.owns_wallet(beneficiary_wallet_id)
);

CREATE POLICY "Depositors can delete their agreements"
ON public.escrow_agreements FOR DELETE
TO authenticated
USING (private.owns_wallet(depositor_wallet_id));

-- Transactions: own rows, plus any tied to an agreement the user is a party to.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own and agreement transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (
    profile_id = (SELECT private.current_profile_id())
    OR private.owns_wallet(wallet_id)
    OR (escrow_agreement_id IS NOT NULL AND private.is_agreement_party(escrow_agreement_id))
    OR private.is_agreement_transaction_party(id)
);

CREATE POLICY "Users can create their own transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (
    profile_id = (SELECT private.current_profile_id())
    AND private.owns_wallet(wallet_id)
    AND (escrow_agreement_id IS NULL OR private.is_agreement_party(escrow_agreement_id))
);

CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (profile_id = (SELECT private.current_profile_id()))
WITH CHECK (
    profile_id = (SELECT private.current_profile_id())
    AND private.owns_wallet(wallet_id)
    AND (escrow_agreement_id IS NULL OR private.is_agreement_party(escrow_agreement_id))
);

CREATE POLICY "Users can delete their own transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (profile_id = (SELECT private.current_profile_id()));

-- Dispute resolutions: not used by the app yet. Parties can read them; writes need the secret key.
ALTER TABLE public.dispute_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view disputes on their agreements"
ON public.dispute_resolutions FOR SELECT
TO authenticated
USING (private.is_agreement_party(escrow_agreement_id));

-- Replace comments left over from the migration that turned RLS off.
COMMENT ON TABLE public.wallets IS NULL;
COMMENT ON TABLE public.transactions IS NULL;
COMMENT ON TABLE public.escrow_agreements IS NULL;
COMMENT ON TABLE public.dispute_resolutions IS NULL;
