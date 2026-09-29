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

-- Restrict what signed-in users can WRITE to the tables that decide who gets paid.
--
-- The RLS added in 20260916130000 scoped reads well, but it let either party update
-- ANY column of an agreement, and let users rewrite their own transactions and profile
-- email. Concretely:
--
--   * Terms: the beneficiary could edit `terms.tasks` to something trivial and then
--     "validate" any image to release the funds, or edit `terms.amounts` after the fact.
--   * Status / circle_contract_id: either party could set them directly, skipping the
--     deposit and validation steps the API routes enforce.
--   * Transactions: users could rewrite status and amount on their own history rows.
--   * Profile email: the recipient picker lists people by "name (email)", and `email`
--     was editable, so a user could impersonate someone else in it.
--
-- Everything that changes money-related state now happens in server routes that have
-- checked the caller's role and use the secret key (which bypasses RLS).

-- Helper: does the signed-in user own this transaction? Used so an agreement cannot
-- point at somebody else's transaction (which the read policy would then expose).
CREATE OR REPLACE FUNCTION private.owns_transaction(p_transaction_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.transactions t
        WHERE t.id = p_transaction_id
          AND t.profile_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION private.owns_transaction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.owns_transaction(uuid) TO authenticated;


-- ===========================================================================
-- escrow_agreements
-- ===========================================================================

-- New agreements start INITIATED, undeployed, and may only point at the creator's
-- own funding transaction.
DROP POLICY IF EXISTS "Depositors can create agreements" ON public.escrow_agreements;

CREATE POLICY "Depositors can create agreements"
ON public.escrow_agreements FOR INSERT
TO authenticated
WITH CHECK (
    private.owns_wallet(depositor_wallet_id)
    AND status = 'INITIATED'
    AND circle_contract_id IS NULL
    AND (transaction_id IS NULL OR private.owns_transaction(transaction_id))
);

-- Only the depositor may edit terms, only before the contract is deployed, and only
-- the `terms` column (see the GRANT below). After that they are fixed.
DROP POLICY IF EXISTS "Parties can update their agreements" ON public.escrow_agreements;

CREATE POLICY "Depositors can edit terms before deployment"
ON public.escrow_agreements FOR UPDATE
TO authenticated
USING (private.owns_wallet(depositor_wallet_id) AND status = 'INITIATED')
WITH CHECK (private.owns_wallet(depositor_wallet_id) AND status = 'INITIATED');

REVOKE UPDATE ON public.escrow_agreements FROM anon, authenticated;
GRANT UPDATE (terms) ON public.escrow_agreements TO authenticated;

-- Deleting an agreement that has funds locked in a contract would orphan them. The UI
-- only offers delete while INITIATED; the refund webhook deletes with the secret key.
DROP POLICY IF EXISTS "Depositors can delete their agreements" ON public.escrow_agreements;

CREATE POLICY "Depositors can delete uninitiated agreements"
ON public.escrow_agreements FOR DELETE
TO authenticated
USING (private.owns_wallet(depositor_wallet_id) AND status = 'INITIATED');


-- ===========================================================================
-- transactions
-- ===========================================================================

-- Users record their own history (insert) and can remove an abandoned one (delete),
-- but never change one afterwards. The webhook and API routes update with the secret key.
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

REVOKE UPDATE ON public.transactions FROM anon, authenticated;


-- ===========================================================================
-- profiles
-- ===========================================================================

-- Identity columns (auth_user_id, email, is_active) are set by the server. Users may
-- edit only what they type into the UI. `avatar_url` stays writable because the
-- profile-picture storage trigger updates it as the uploading user.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (name, full_name, company_name, avatar_url) ON public.profiles TO authenticated;
