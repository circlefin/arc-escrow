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
import { queryBuilder } from "../helpers/supabase-mock";
import {
  ALICE,
  BOB,
  CAROL,
  adminUpdatesAgreement,
  agreementRow,
  signedInAs,
  signedOut,
} from "../helpers/scenario";

const user = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }));
const admin = vi.hoisted(() => ({ from: vi.fn() }));
const contractSdk = vi.hoisted(() => ({ getContract: vi.fn() }));
const walletSdk = vi.hoisted(() => ({ createContractExecutionTransaction: vi.fn() }));

vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: async () => user }));
vi.mock("@/lib/supabase/admin-client", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/utils/smart-contract-platform-client", () => ({ circleContractSdk: contractSdk }));
vi.mock("@/lib/utils/developer-controlled-wallets-client", () => ({ circleDeveloperSdk: walletSdk }));

import { POST as approve } from "@/app/api/contracts/escrow/deposit/approve/route";
import { POST as deposit } from "@/app/api/contracts/escrow/deposit/route";
import { POST as refund } from "@/app/api/contracts/escrow/refund/route";

const CONTRACT_ADDRESS = "0x" + "99".repeat(20);

const post = (handler: (req: NextRequest) => Promise<Response>, body: unknown = { circleContractId: "cc-1" }) =>
  handler(
    new NextRequest("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

/** What a route needs after authorization: the transaction row it records. */
const recordedTransaction = () => ({ transactions: [queryBuilder({ data: { id: "tx-new" } })] });

const fullAgreement = (overrides: Record<string, unknown> = {}) =>
  agreementRow({
    beneficiary_wallet: { wallet_address: BOB.wallet_address },
    transactions: { amount: 100 },
    ...overrides,
  });

beforeEach(() => {
  user.from.mockReset();
  user.auth.getUser.mockReset();
  admin.from.mockReset();
  contractSdk.getContract.mockReset();
  walletSdk.createContractExecutionTransaction.mockReset();
  contractSdk.getContract.mockResolvedValue({
    data: { contract: { id: "cc-1", contractAddress: CONTRACT_ADDRESS } },
  });
  walletSdk.createContractExecutionTransaction.mockResolvedValue({
    data: { id: "circle-tx-1", state: "INITIATED" },
  });
});

describe.each([
  ["approve", approve],
  ["deposit", deposit],
  ["refund", refund],
] as const)("POST /api/contracts/escrow/%s — access control", (_name, handler) => {
  it("refuses a signed-out caller before doing anything", async () => {
    signedOut(user);
    expect((await post(handler)).status).toBe(401);
    expect(contractSdk.getContract).not.toHaveBeenCalled();
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it("does not reveal or act on an agreement the caller is not a party to", async () => {
    signedInAs(user, CAROL, null);
    expect((await post(handler)).status).toBe(404);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it("rejects a request with no contract id", async () => {
    signedInAs(user, ALICE, fullAgreement());
    expect((await post(handler, {})).status).toBe(400);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/contracts/escrow/refund", () => {
  const locked = () => fullAgreement({ status: "LOCKED" });

  it("does NOT let the depositor force the beneficiary's wallet to refund them", async () => {
    signedInAs(user, ALICE, locked());
    const res = await post(refund);
    expect(res.status).toBe(403);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
    expect(contractSdk.getContract).not.toHaveBeenCalled();
  });

  it("only refunds while the funds are locked", async () => {
    signedInAs(user, BOB, fullAgreement({ status: "OPEN" }));
    expect((await post(refund)).status).toBe(409);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it("lets the beneficiary refund, executing from their own wallet", async () => {
    signedInAs(user, BOB, locked(), recordedTransaction());
    const update = adminUpdatesAgreement(admin);

    const res = await post(refund);

    expect(res.status).toBe(201);
    expect(walletSdk.createContractExecutionTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: BOB.circle_wallet_id,
        contractAddress: CONTRACT_ADDRESS,
        abiFunctionSignature: "refundByRecipient(uint256)",
      })
    );
    expect(update.update).toHaveBeenCalledWith({ status: "PENDING" });
  });
});

describe("POST /api/contracts/escrow/deposit/approve", () => {
  it("does not let the beneficiary approve spending for the depositor", async () => {
    signedInAs(user, BOB, fullAgreement());
    expect((await post(approve)).status).toBe(403);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it("only approves while the agreement is OPEN", async () => {
    signedInAs(user, ALICE, fullAgreement({ status: "LOCKED" }));
    expect((await post(approve)).status).toBe(409);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it("lets the depositor approve USDC spending from their own wallet", async () => {
    signedInAs(user, ALICE, fullAgreement(), recordedTransaction());
    const update = adminUpdatesAgreement(admin);

    const res = await post(approve);

    expect(res.status).toBe(201);
    expect(walletSdk.createContractExecutionTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: ALICE.circle_wallet_id,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [CONTRACT_ADDRESS, 100_000_000],
      })
    );
    expect(update.update).toHaveBeenCalledWith({ status: "PENDING" });
  });
});

describe("POST /api/contracts/escrow/deposit", () => {
  it("does not let the beneficiary pay in place of the depositor", async () => {
    signedInAs(user, BOB, fullAgreement());
    expect((await post(deposit)).status).toBe(403);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it("does not accept a deposit into a closed or locked agreement", async () => {
    for (const status of ["LOCKED", "CLOSED", "INITIATED"]) {
      signedInAs(user, ALICE, fullAgreement({ status }));
      expect((await post(deposit)).status).toBe(409);
    }
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it.each(["OPEN", "PENDING"])("lets the depositor pay from their wallet when %s", async (status) => {
    signedInAs(user, ALICE, fullAgreement({ status }), recordedTransaction());
    adminUpdatesAgreement(admin);

    const res = await post(deposit);

    expect(res.status).toBe(201);
    expect(walletSdk.createContractExecutionTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: ALICE.circle_wallet_id,
        abiFunctionSignature: "pay(address,uint256,address)",
        abiParameters: [BOB.wallet_address, 100_000_000, ALICE.wallet_address],
      })
    );
  });
});
