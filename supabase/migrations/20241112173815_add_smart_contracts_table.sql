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

create table if not exists public.smart_contracts (
    id uuid not null default uuid_generate_v4() primary key,
    wallet_id uuid references public.wallets(id),
    escrow_agreement_id uuid not null references public.escrow_agreements(id),
    contract_address varchar(255),
    blockchain varchar(50),
    status varchar(50) default 'PENDING'::varchar,
    transaction_hash varchar(255),
    deployer_address varchar(255),
    parties jsonb default '[]'::jsonb,
    metadata jsonb default '{}'::jsonb,
    deployment_date timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    is_active boolean default true
);

create index if not exists smart_contracts_wallet_id_idx on public.smart_contracts (wallet_id);
create index if not exists smart_contracts_escrow_agreement_id_idx on public.smart_contracts (escrow_agreement_id);