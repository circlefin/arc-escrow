-- Security Measure: Revoke dangerous anonymous privileges left over from development
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon;

-- 1. Re-enable and enforce Row Level Security (RLS) across all critical tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_resolutions ENABLE ROW LEVEL SECURITY;

-- 2. Drop old, potentially conflicting policies (Starting with a clean slate)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallets" ON wallets;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view related escrow agreements" ON escrow_agreements;
DROP POLICY IF EXISTS "Users can insert escrow agreements" ON escrow_agreements;
DROP POLICY IF EXISTS "Users can view related dispute resolutions" ON dispute_resolutions;

-- 3. PROFILES: Viewable by everyone, but can only be updated by the account owner (auth.uid())
CREATE POLICY "Profiles are viewable by everyone" ON profiles 
    FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);

-- 4. WALLETS: Strict ownership control. Only the wallet owner (auth.uid() = user_id) can mutate.
CREATE POLICY "Users can view own wallets" ON wallets 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallets" ON wallets 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallets" ON wallets 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own wallets" ON wallets 
    FOR DELETE USING (auth.uid() = user_id);

-- 5. TRANSACTIONS: Transactions belong strictly to the owner.
CREATE POLICY "Users can view own transactions" ON transactions 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. ESCROW AGREEMENTS: The most critical table.
-- Only the owners of the beneficiary or depositor wallets can view and update.
CREATE POLICY "Users can view related escrow agreements" ON escrow_agreements 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM wallets w 
            WHERE (w.id = escrow_agreements.beneficiary_wallet_id OR w.id = escrow_agreements.depositor_wallet_id)
            AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert escrow agreements" ON escrow_agreements 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM wallets w 
            WHERE (w.id = beneficiary_wallet_id OR w.id = depositor_wallet_id)
            AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update related escrow agreements" ON escrow_agreements 
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM wallets w 
            WHERE (w.id = escrow_agreements.beneficiary_wallet_id OR w.id = escrow_agreements.depositor_wallet_id)
            AND w.user_id = auth.uid()
        )
    );

-- 7. DISPUTE RESOLUTIONS: Only accessible by the parties of the related escrow agreement or the authorized resolver.
CREATE POLICY "Users can view related dispute resolutions" ON dispute_resolutions 
    FOR SELECT USING (
        auth.uid() = resolver_user_id OR
        EXISTS (
            SELECT 1 FROM escrow_agreements ea 
            JOIN wallets w ON (w.id = ea.beneficiary_wallet_id OR w.id = ea.depositor_wallet_id)
            WHERE ea.id = dispute_resolutions.escrow_agreement_id 
            AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert related dispute resolutions" ON dispute_resolutions 
    FOR INSERT WITH CHECK (
        auth.uid() = resolver_user_id OR
        EXISTS (
            SELECT 1 FROM escrow_agreements ea 
            JOIN wallets w ON (w.id = ea.beneficiary_wallet_id OR w.id = ea.depositor_wallet_id)
            WHERE ea.id = escrow_agreement_id 
            AND w.user_id = auth.uid()
        )
    );