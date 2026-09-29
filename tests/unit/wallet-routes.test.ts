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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { queryBuilder, queueTables } from "../helpers/supabase-mock";
import { ALICE, BOB, signedOut } from "../helpers/scenario";

// The transactions routes refuse to load without these, and imports are hoisted.
vi.hoisted(() => {
  process.env.CIRCLE_API_KEY ??= "TEST_API_KEY:x:y";
  process.env.CIRCLE_ENTITY_SECRET ??= "x";
});

const user = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }));
const walletSdk = vi.hoisted(() => ({
  getWalletTokenBalance: vi.fn(),
  listTransactions: vi.fn(),
  getTransaction: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: async () => user }));
vi.mock("@/lib/utils/developer-controlled-wallets-client", () => ({ circleDeveloperSdk: walletSdk }));

import { POST as balance } from "@/app/api/wallet/balance/route";
import { POST as transactions } from "@/app/api/wallet/transactions/route";
import { GET as transactionById } from "@/app/api/wallet/transactions/[id]/route";

const WALLET_UUID = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const OTHER_WALLET_UUID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const TX_UUID = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

const own = { ...ALICE, circle_wallet_id: WALLET_UUID };

function signIn(wallet: typeof own | null, extra: Record<string, ReturnType<typeof queryBuilder>[]> = {}) {
  user.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-alice" } } });
  queueTables(user, {
    profiles: [queryBuilder({ data: wallet ? { id: wallet.profile_id } : null })],
    wallets: [queryBuilder({ data: wallet })],
    ...extra,
  });
}

const json = (handler: (r: NextRequest) => Promise<Response>, body: unknown) =>
  handler(
    new NextRequest("http://localhost/api/wallet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  user.from.mockReset();
  user.auth.getUser.mockReset();
  Object.values(walletSdk).forEach((fn) => fn.mockReset());
});

describe.each([
  ["balance", balance, "getWalletTokenBalance"],
  ["transactions", transactions, "listTransactions"],
] as const)("POST /api/wallet/%s", (_name, handler, sdkMethod) => {
  it("refuses a signed-out caller without calling Circle", async () => {
    signedOut(user);
    expect((await json(handler, { walletId: WALLET_UUID })).status).toBe(401);
    expect(walletSdk[sdkMethod]).not.toHaveBeenCalled();
  });

  it("refuses to read someone else's wallet (any user can list every wallet id)", async () => {
    signIn(own);
    const res = await json(handler, { walletId: OTHER_WALLET_UUID });
    expect(res.status).toBe(403);
    expect(walletSdk[sdkMethod]).not.toHaveBeenCalled();
  });

  it("refuses a caller who has no wallet", async () => {
    signIn(null);
    expect((await json(handler, { walletId: WALLET_UUID })).status).toBe(403);
    expect(walletSdk[sdkMethod]).not.toHaveBeenCalled();
  });

  it("rejects a walletId that is not a uuid", async () => {
    signIn(own);
    expect((await json(handler, { walletId: "../../etc" })).status).toBe(400);
    expect(walletSdk[sdkMethod]).not.toHaveBeenCalled();
  });
});

describe("own-wallet reads", () => {
  it("returns the caller's USDC balance", async () => {
    signIn(own);
    walletSdk.getWalletTokenBalance.mockResolvedValue({
      data: {
        tokenBalances: [
          { token: { symbol: "EURC" }, amount: "5" },
          { token: { symbol: "USDC" }, amount: "12.5" },
        ],
      },
    });
    const res = await json(balance, { walletId: WALLET_UUID });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ balance: "12.5" });
  });

  it("reports 0 when the wallet holds no USDC", async () => {
    signIn(own);
    walletSdk.getWalletTokenBalance.mockResolvedValue({ data: { tokenBalances: [] } });
    expect(await (await json(balance, { walletId: WALLET_UUID })).json()).toEqual({ balance: "0" });
  });

  it("lists the caller's Circle transactions", async () => {
    signIn(own);
    walletSdk.listTransactions.mockResolvedValue({
      data: {
        transactions: [
          { id: "t1", amounts: ["10"], state: "COMPLETE", transactionType: "OUTBOUND", createDate: "2026-09-18" },
        ],
      },
    });
    const res = await json(transactions, { walletId: WALLET_UUID });
    expect(res.status).toBe(200);
    expect((await res.json()).transactions[0]).toMatchObject({ id: "t1", status: "COMPLETE" });
    expect(walletSdk.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ walletIds: [WALLET_UUID] })
    );
  });
});

describe("GET /api/wallet/transactions/[id]", () => {
  const get = (id: string) =>
    transactionById(new NextRequest(`http://localhost/api/wallet/transactions/${id}`), {
      params: Promise.resolve({ id }),
    });

  it("refuses a signed-out caller", async () => {
    signedOut(user);
    expect((await get(TX_UUID)).status).toBe(401);
    expect(walletSdk.getTransaction).not.toHaveBeenCalled();
  });

  it("rejects an id that is not a uuid", async () => {
    signedOut(user);
    expect((await get("not-a-uuid")).status).toBe(400);
  });

  it("does not disclose a transaction the caller cannot see", async () => {
    user.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-bob" } } });
    queueTables(user, { transactions: [queryBuilder({ data: [] })] });
    expect((await get(TX_UUID)).status).toBe(404);
    expect(walletSdk.getTransaction).not.toHaveBeenCalled();
  });

  it("returns a transaction the caller can see", async () => {
    user.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-bob" } } });
    queueTables(user, { transactions: [queryBuilder({ data: [{ id: "row" }] })] });
    walletSdk.getTransaction.mockResolvedValue({
      data: {
        transaction: {
          id: TX_UUID, amounts: ["1"], state: "COMPLETE", createDate: "2026-09-18",
          blockchain: "ARC-TESTNET", transactionType: "OUTBOUND", updateDate: "2026-09-18",
        },
      },
    });
    const res = await get(TX_UUID);
    expect(res.status).toBe(200);
    expect((await res.json()).transaction).toMatchObject({ id: TX_UUID, state: "COMPLETE" });
    void BOB;
  });
});
