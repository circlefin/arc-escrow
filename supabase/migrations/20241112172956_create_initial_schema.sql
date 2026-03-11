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

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (instead of Users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles 
    FOR SELECT USING (is_active = true);
CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);

-- Create improved handle_new_user function with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE 
    display_name TEXT;
BEGIN
    -- Get display name from raw_user_meta_data if available, otherwise use email
    display_name := COALESCE(
        (NEW.raw_user_meta_data->>'full_name'),
        split_part(NEW.email, '@', 1),
        NEW.email
    );
    
    BEGIN
        INSERT INTO public.profiles (id, name)
        VALUES (NEW.id, display_name);
    EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
    END;
    
    RETURN NEW;
END;
$$;

-- Create the trigger with proper timing and security
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_wallet_id VARCHAR NOT NULL,
    wallet_type VARCHAR NOT NULL,
    balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
    currency VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS on wallets
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create wallets policies
CREATE POLICY "Users can view own wallets" ON wallets 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallets" ON wallets 
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallets" ON wallets 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_transaction_id VARCHAR NOT NULL,
    transaction_type VARCHAR NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Enable RLS on transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create transactions policies
CREATE POLICY "Users can view own transactions" ON transactions 
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Escrow Agreements table
CREATE TABLE escrow_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beneficiary_wallet_id UUID NOT NULL REFERENCES wallets(id),
    depositor_wallet_id UUID NOT NULL REFERENCES wallets(id),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    status VARCHAR NOT NULL,
    disbursement_date TIMESTAMP WITH TIME ZONE,
    terms JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on escrow_agreements
ALTER TABLE escrow_agreements ENABLE ROW LEVEL SECURITY;

-- Create escrow agreements policies
CREATE POLICY "Users can view related escrow agreements" ON escrow_agreements 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM wallets w 
            WHERE (w.id = escrow_agreements.beneficiary_wallet_id 
                OR w.id = escrow_agreements.depositor_wallet_id)
                AND w.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert escrow agreements" ON escrow_agreements 
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 
            FROM wallets w 
            WHERE (w.id = beneficiary_wallet_id 
                OR w.id = depositor_wallet_id)
                AND w.user_id = auth.uid()
        )
    );

-- Dispute Resolutions table
CREATE TABLE dispute_resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_agreement_id UUID NOT NULL REFERENCES escrow_agreements(id),
    resolver_user_id UUID NOT NULL REFERENCES profiles(id),
    status VARCHAR NOT NULL,
    resolution_type VARCHAR NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on dispute_resolutions
ALTER TABLE dispute_resolutions ENABLE ROW LEVEL SECURITY;

-- Create dispute resolutions policies
CREATE POLICY "Users can view related dispute resolutions" ON dispute_resolutions 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM escrow_agreements ea 
            JOIN wallets w ON (
                w.id = ea.beneficiary_wallet_id 
                OR w.id = ea.depositor_wallet_id
            )
            WHERE ea.id = dispute_resolutions.escrow_agreement_id 
            AND w.user_id = auth.uid()
        )
    );

-- Add indexes for foreign keys and frequently queried columns
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_escrow_agreements_transaction_id ON escrow_agreements(transaction_id);
CREATE INDEX idx_escrow_agreements_beneficiary_wallet_id ON escrow_agreements(beneficiary_wallet_id);
CREATE INDEX idx_escrow_agreements_depositor_wallet_id ON escrow_agreements(depositor_wallet_id);
CREATE INDEX idx_dispute_resolutions_escrow_agreement_id ON dispute_resolutions(escrow_agreement_id);
CREATE INDEX idx_dispute_resolutions_resolver_user_id ON dispute_resolutions(resolver_user_id);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_agreements_updated_at
    BEFORE UPDATE ON escrow_agreements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant additional permissions if needed
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant usage of uuid-ossp functions
GRANT EXECUTE ON FUNCTION uuid_generate_v4() TO anon;
GRANT EXECUTE ON FUNCTION uuid_generate_v4() TO authenticated;
GRANT EXECUTE ON FUNCTION uuid_generate_v4() TO service_role;

-- Grant table permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;