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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { queryBuilder, queueTables } from "../helpers/supabase-mock";
import { ALICE, BOB, CAROL, agreementRow, signedInAs, signedOut } from "../helpers/scenario";

const user = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }));
const admin = vi.hoisted(() => ({ from: vi.fn() }));
const contractSdk = vi.hoisted(() => ({ deployContract: vi.fn() }));
const walletSdk = vi.hoisted(() => ({ getTransaction: vi.fn() }));

vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: async () => user }));
vi.mock("@/lib/supabase/admin-client", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/utils/smart-contract-platform-client", () => ({ circleContractSdk: contractSdk }));
vi.mock("@/lib/utils/developer-controlled-wallets-client", () => ({ circleDeveloperSdk: walletSdk }));

import { GET, POST } from "@/app/api/contracts/escrow/route";

const AGREEMENT_ID = "6f9b1c2e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";
const TX_ID = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";
const AGENT_WALLET_ID = "11111111-2222-4333-8444-555555555555";
const AGENT_ADDRESS = "0x" + "77".repeat(20);

const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/contracts/escrow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

const initiated = (over: Record<string, unknown> = {}) =>
  agreementRow({
    id: AGREEMENT_ID,
    status: "INITIATED",
    circle_contract_id: null,
    depositor_wallet: { wallet_address: ALICE.wallet_address },
    beneficiary_wallet: { wallet_address: BOB.wallet_address },
    ...over,
  });

beforeEach(() => {
  user.from.mockReset();
  user.auth.getUser.mockReset();
  admin.from.mockReset();
  contractSdk.deployContract.mockReset();
  walletSdk.getTransaction.mockReset();
  vi.stubEnv("NEXT_PUBLIC_AGENT_WALLET_ID", AGENT_WALLET_ID);
  vi.stubEnv("NEXT_PUBLIC_AGENT_WALLET_ADDRESS", AGENT_ADDRESS);
  contractSdk.deployContract.mockResolvedValue({
    data: { contractId: "contract-9", transactionId: "circle-tx-9" },
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/contracts/escrow (deploy)", () => {
  it("does not spend the agent wallet for a signed-out caller", async () => {
    signedOut(user);
    expect((await post({ agreement: { id: AGREEMENT_ID } })).status).toBe(401);
    expect(contractSdk.deployContract).not.toHaveBeenCalled();
  });

  it.each([
    ["no agreement", {}],
    ["a non-uuid id", { agreement: { id: "not-a-uuid" } }],
    ["a non-string id", { agreement: { id: 7 } }],
  ])("rejects %s", async (_name, body) => {
    signedInAs(user, ALICE, initiated());
    expect((await post(body)).status).toBe(400);
    expect(contractSdk.deployContract).not.toHaveBeenCalled();
  });

  it("does not deploy for an agreement the caller cannot see", async () => {
    signedInAs(user, CAROL, null);
    expect((await post({ agreement: { id: AGREEMENT_ID } })).status).toBe(404);
    expect(contractSdk.deployContract).not.toHaveBeenCalled();
  });

  it("only the depositor may deploy", async () => {
    signedInAs(user, BOB, initiated());
    expect((await post({ agreement: { id: AGREEMENT_ID } })).status).toBe(403);
    expect(contractSdk.deployContract).not.toHaveBeenCalled();
  });

  it("does not deploy a second contract for an agreement already deployed", async () => {
    signedInAs(user, ALICE, initiated({ status: "PENDING", circle_contract_id: "contract-1" }));
    expect((await post({ agreement: { id: AGREEMENT_ID } })).status).toBe(409);
    expect(contractSdk.deployContract).not.toHaveBeenCalled();
  });

  it("does not deploy when a concurrent request already claimed the agreement", async () => {
    signedInAs(user, ALICE, initiated());
    queueTables(admin, { escrow_agreements: [queryBuilder({ data: [] })] });
    expect((await post({ agreement: { id: AGREEMENT_ID } })).status).toBe(409);
    expect(contractSdk.deployContract).not.toHaveBeenCalled();
  });

  it("is refused when the agent wallet is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_AGENT_WALLET_ID", "");
    signedInAs(user, ALICE, initiated());
    expect((await post({ agreement: { id: AGREEMENT_ID } })).status).toBe(500);
    expect(contractSdk.deployContract).not.toHaveBeenCalled();
  });

  it("deploys using addresses from the database, ignoring any the browser sends", async () => {
    signedInAs(user, ALICE, initiated());
    const claim = queryBuilder({ data: [{ id: AGREEMENT_ID }] });
    const saveContract = queryBuilder({});
    const saveTransaction = queryBuilder({});
    queueTables(admin, {
      escrow_agreements: [claim, saveContract],
      transactions: [saveTransaction],
    });

    const res = await post({
      agreement: {
        id: AGREEMENT_ID,
        beneficiary_wallet: { wallet_address: "0x" + "ee".repeat(20) },
      },
      agentAddress: "0x" + "ff".repeat(20),
    });

    expect(res.status).toBe(201);
    const deploy = contractSdk.deployContract.mock.calls[0][0];
    expect(deploy.name).toContain(BOB.wallet_address);
    expect(deploy.name).not.toContain("eeee");
    expect(deploy.walletId).toBe(AGENT_WALLET_ID);
    expect(deploy.constructorParameters[0]).toBe(AGENT_ADDRESS);

    expect(claim.update).toHaveBeenCalledWith({ status: "PENDING" });
    expect(claim.in).toHaveBeenCalledWith("status", ["INITIATED"]);
    expect(saveContract.update).toHaveBeenCalledWith({ circle_contract_id: "contract-9" });
    expect(saveTransaction.update).toHaveBeenCalledWith({ circle_transaction_id: "circle-tx-9" });
    expect((await res.json()).addresses.agent).toBe(AGENT_ADDRESS);
  });

  it("releases the claim so the depositor can retry when deployment fails", async () => {
    signedInAs(user, ALICE, initiated());
    const claim = queryBuilder({ data: [{ id: AGREEMENT_ID }] });
    const release = queryBuilder({ data: [{ id: AGREEMENT_ID }] });
    queueTables(admin, { escrow_agreements: [claim, release] });
    contractSdk.deployContract.mockRejectedValue(new Error("circle down"));

    const res = await post({ agreement: { id: AGREEMENT_ID } });

    expect(res.status).toBe(500);
    expect(release.update).toHaveBeenCalledWith({ status: "INITIATED" });
    expect(release.in).toHaveBeenCalledWith("status", ["PENDING"]);
  });
});

describe("GET /api/contracts/escrow (status polling)", () => {
  const get = (id?: string) =>
    GET(new NextRequest(`http://localhost/api/contracts/escrow${id ? `?id=${id}` : ""}`));

  it("refuses a signed-out caller", async () => {
    signedOut(user);
    expect((await get(TX_ID)).status).toBe(401);
    expect(walletSdk.getTransaction).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed id without calling Circle", async () => {
    signedInAs(user, ALICE, null);
    expect((await get()).status).toBe(400);
    expect((await get("nope")).status).toBe(400);
    expect(walletSdk.getTransaction).not.toHaveBeenCalled();
  });

  it("does not poll Circle for a transaction the caller cannot see", async () => {
    signedInAs(user, CAROL, null, { transactions: [queryBuilder({ data: [] })] });
    expect((await get(TX_ID)).status).toBe(404);
    expect(walletSdk.getTransaction).not.toHaveBeenCalled();
  });

  it("returns the status of a transaction the caller can see", async () => {
    signedInAs(user, ALICE, null, { transactions: [queryBuilder({ data: [{ id: "row" }] })] });
    walletSdk.getTransaction.mockResolvedValue({
      data: { transaction: { state: "COMPLETE" } },
    });
    const res = await get(TX_ID);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("COMPLETE");
  });
});
