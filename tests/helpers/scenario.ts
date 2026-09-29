/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { vi } from "vitest";
import { queryBuilder, queueTables, type QueryBuilder } from "./supabase-mock";

type UserClient = {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

export const ALICE = {
  id: "w-alice",
  profile_id: "p-alice",
  circle_wallet_id: "cw-alice",
  wallet_address: "0x" + "a1".repeat(20),
};

export const BOB = {
  id: "w-bob",
  profile_id: "p-bob",
  circle_wallet_id: "cw-bob",
  wallet_address: "0x" + "b2".repeat(20),
};

export const CAROL = {
  id: "w-carol",
  profile_id: "p-carol",
  circle_wallet_id: "cw-carol",
  wallet_address: "0x" + "c3".repeat(20),
};

/** An agreement where Alice deposits and Bob is the beneficiary. */
export function agreementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ag-1",
    circle_contract_id: "cc-1",
    depositor_wallet_id: ALICE.id,
    beneficiary_wallet_id: BOB.id,
    transaction_id: "tx-1",
    status: "OPEN",
    terms: {
      amounts: [{ amount: "$100.00", for: "Logo design" }],
      tasks: ["Deliver a PNG logo"],
    },
    ...overrides,
  };
}

export function signedOut(client: UserClient) {
  client.auth.getUser.mockResolvedValue({ data: { user: null } });
  client.from.mockImplementation((table: string) => {
    throw new Error(`Signed-out request must not query "${table}"`);
  });
}

/**
 * Signs `wallet`'s owner in and queues the three lookups every authorized route
 * makes first: their profile, their wallet, then the agreement (null = hidden by RLS).
 * `extra` queues further tables, in order, for the rest of the route.
 */
export function signedInAs(
  client: UserClient,
  wallet: typeof ALICE,
  agreement: Record<string, unknown> | null,
  extra: Record<string, QueryBuilder[]> = {}
) {
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: `auth-${wallet.profile_id}`, email: `${wallet.profile_id}@example.com` } },
  });
  queueTables(client, {
    profiles: [queryBuilder({ data: { id: wallet.profile_id } })],
    wallets: [queryBuilder({ data: wallet })],
    escrow_agreements: [queryBuilder({ data: agreement })],
    ...extra,
  });
}

/** An admin-client stub whose `escrow_agreements` update reports `rows` rows changed. */
export function adminUpdatesAgreement(
  admin: { from: ReturnType<typeof vi.fn> },
  rows = 1
) {
  const update = queryBuilder({ data: Array.from({ length: rows }, () => ({ id: "ag-1" })) });
  queueTables(admin, { escrow_agreements: [update] });
  return update;
}
