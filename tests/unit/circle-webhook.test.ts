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

import crypto from "crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { queryBuilder, queueTables, type QueryBuilder } from "../helpers/supabase-mock";

const admin = vi.hoisted(() => ({ from: vi.fn() }));
const getUsdcBalance = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin-client", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/circle/wallet-data", () => ({ getUsdcBalance }));

import { POST } from "@/app/api/webhooks/circle/route";

// A real key pair: the route verifies real signatures against the key Circle serves.
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

function signedRequest(rawBody: string, { signWith = rawBody } = {}) {
  const signature = crypto.createSign("SHA256").update(signWith).sign(privateKey).toString("base64");
  return new NextRequest("http://localhost/api/webhooks/circle", {
    method: "POST",
    headers: { "x-circle-signature": signature, "x-circle-key-id": "key-1" },
    body: rawBody,
  });
}

const notification = (n: Record<string, unknown>) => ({
  subscriptionId: "sub-1",
  notificationId: "n-1",
  notificationType: "transactions.outbound",
  notification: { id: "circle-tx-1", ...n },
});

interface Flow {
  txRow: Record<string, unknown> | null;
  agreement?: Record<string, unknown>;
}

/** Queues what updateAgreementTransaction reads and writes, in call order. */
function queueFlow({ txRow, agreement = { id: "ag-1", status: "PENDING" } }: Flow) {
  const txUpdate = queryBuilder({});
  const agreementRead = queryBuilder({ data: agreement });
  const agreementWrite = queryBuilder({});
  queueTables(admin, {
    transactions: [queryBuilder({ data: txRow, error: txRow ? null : { message: "none" } }), txUpdate],
    escrow_agreements: [agreementRead, agreementWrite],
  });
  return { txUpdate, agreementWrite };
}

const tx = (type: string, over: Record<string, unknown> = {}) => ({
  id: "tx-row",
  status: "PENDING",
  transaction_type: type,
  escrow_agreement_id: "ag-1",
  ...over,
});

beforeAll(() => {
  vi.stubEnv("CIRCLE_API_KEY", "test-key");
});

beforeEach(() => {
  admin.from.mockReset();
  getUsdcBalance.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ data: { publicKey: publicKeyBase64 } }) }))
  );
});

describe("POST /api/webhooks/circle — authenticity", () => {
  it("rejects requests without signature headers", async () => {
    const res = await POST(new NextRequest("http://localhost/x", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("rejects a payload whose signature does not match, touching nothing", async () => {
    const body = JSON.stringify(notification({ state: "COMPLETE" }));
    const res = await POST(signedRequest(body, { signWith: body + " " }));
    expect(res.status).toBe(403);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("verifies the exact bytes received, not a re-serialization of them", async () => {
    // Pretty-printed JSON differs from JSON.stringify(JSON.parse(body)).
    const body = JSON.stringify(notification({ state: "COMPLETE" }), null, 4);
    queueFlow({ txRow: tx("DEPLOY_CONTRACT") });
    expect((await POST(signedRequest(body))).status).toBe(200);
  });

  it("answers 400 to a validly signed body that is not JSON", async () => {
    expect((await POST(signedRequest("not json"))).status).toBe(400);
  });
});

describe("POST /api/webhooks/circle — agreement status", () => {
  const run = async (n: Record<string, unknown>, flow: Flow) => {
    const writes = queueFlow(flow);
    const res = await POST(signedRequest(JSON.stringify(notification(n))));
    expect(res.status).toBe(200);
    return writes;
  };

  it.each([
    ["DEPLOY_CONTRACT", "COMPLETE", "OPEN"],
    ["DEPOSIT_APPROVAL", "FAILED", "OPEN"],
    ["DEPOSIT_PAYMENT", "COMPLETE", "LOCKED"],
    ["DEPOSIT_PAYMENT", "FAILED", "OPEN"],
    ["RELEASE_PAYMENT", "COMPLETE", "CLOSED"],
    ["RELEASE_PAYMENT", "FAILED", "LOCKED"],
    // A failed refund leaves the funds locked; OPEN would invite a second deposit.
    ["DEPOSIT_REFUND", "FAILED", "LOCKED"],
  ])("%s %s moves the agreement to %s", async (type, state, expected) => {
    const { agreementWrite } = await run({ state }, { txRow: tx(type) });
    expect(agreementWrite.update).toHaveBeenCalledWith({ status: expected });
  });

  it("deletes the agreement once a refund completes", async () => {
    const { agreementWrite } = await run({ state: "COMPLETE" }, { txRow: tx("DEPOSIT_REFUND") });
    expect(agreementWrite.delete).toHaveBeenCalled();
  });

  it("records the transaction's new state and contract address", async () => {
    const { txUpdate } = await run(
      { state: "COMPLETE", contractAddress: "0xabc" },
      { txRow: tx("DEPLOY_CONTRACT") }
    );
    expect(txUpdate.update).toHaveBeenCalledWith({ status: "COMPLETE", circle_contract_address: "0xabc" });
  });

  it("does nothing when the state has not changed", async () => {
    queueTables(admin, {
      transactions: [queryBuilder({ data: tx("DEPLOY_CONTRACT", { status: "COMPLETE" }) })],
    });
    const res = await POST(signedRequest(JSON.stringify(notification({ state: "COMPLETE" }))));
    expect(res.status).toBe(200);
    expect(admin.from).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/webhooks/circle — wallet balance", () => {
  const withWallet = (state: string) =>
    JSON.stringify(notification({ state, walletId: "cw-1" }));

  function queueWithWalletUpdate(walletUpdate: QueryBuilder) {
    const txUpdate = queryBuilder({});
    queueTables(admin, {
      wallets: [walletUpdate],
      transactions: [queryBuilder({ data: tx("DEPLOY_CONTRACT") }), txUpdate],
      escrow_agreements: [queryBuilder({ data: { id: "ag-1", status: "PENDING" } }), queryBuilder({})],
    });
  }

  it("refreshes the balance directly, without calling our own API", async () => {
    const walletUpdate = queryBuilder({});
    queueWithWalletUpdate(walletUpdate);
    getUsdcBalance.mockResolvedValue("42.5");

    expect((await POST(signedRequest(withWallet("COMPLETE")))).status).toBe(200);

    expect(getUsdcBalance).toHaveBeenCalledWith("cw-1");
    expect(walletUpdate.update).toHaveBeenCalledWith({ balance: "42.5" });
    expect(fetch).toHaveBeenCalledTimes(1); // only Circle's public-key fetch
  });

  it("still applies the status change when the balance cannot be read", async () => {
    queueWithWalletUpdate(queryBuilder({}));
    getUsdcBalance.mockRejectedValue(new Error("circle down"));

    expect((await POST(signedRequest(withWallet("COMPLETE")))).status).toBe(200);
    expect(admin.from).toHaveBeenCalledWith("escrow_agreements");
  });

  it("does not read the balance for a transaction that is not complete", async () => {
    queueTables(admin, {
      transactions: [queryBuilder({ data: tx("DEPLOY_CONTRACT") }), queryBuilder({})],
      escrow_agreements: [queryBuilder({ data: { id: "ag-1", status: "PENDING" } })],
    });
    await POST(signedRequest(withWallet("CONFIRMED")));
    expect(getUsdcBalance).not.toHaveBeenCalled();
  });
});
