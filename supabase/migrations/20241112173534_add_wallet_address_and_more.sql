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

-- Migration Up
ALTER TABLE wallets
    ADD COLUMN wallet_set_id UUID,
    ADD COLUMN wallet_address VARCHAR(255),
    ADD COLUMN account_type VARCHAR(50),
    ADD COLUMN blockchain VARCHAR(50);

CREATE INDEX idx_wallets_address ON wallets(wallet_address);

-- Add comments for clarity
COMMENT ON COLUMN wallets.wallet_set_id IS 'Reference to the wallet set';
COMMENT ON COLUMN wallets.wallet_address IS 'Blockchain wallet address';
COMMENT ON COLUMN wallets.account_type IS 'Type of blockchain account';
COMMENT ON COLUMN wallets.blockchain IS 'Name of the blockchain network';
