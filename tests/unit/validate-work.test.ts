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

const user = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { getUser: vi.fn() },
  storage: { from: vi.fn() },
}));
const admin = vi.hoisted(() => ({ from: vi.fn() }));
const contractSdk = vi.hoisted(() => ({ getContract: vi.fn() }));
const walletSdk = vi.hoisted(() => ({ createContractExecutionTransaction: vi.fn() }));
const openai = vi.hoisted(() => ({ chat: { completions: { create: vi.fn() } } }));
const upload = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: async () => user }));
vi.mock("@/lib/supabase/admin-client", () => ({ createSupabaseAdminClient: () => admin }));
vi.mock("@/lib/utils/smart-contract-platform-client", () => ({ circleContractSdk: contractSdk }));
vi.mock("@/lib/utils/developer-controlled-wallets-client", () => ({ circleDeveloperSdk: walletSdk }));
vi.mock("@/lib/utils/openAIClient", () => ({ openai }));

import { POST } from "@/app/api/contracts/validate-work/route";

const CONTRACT_ADDRESS = "0x" + "99".repeat(20);

const locked = () =>
  agreementRow({
    status: "LOCKED",
    beneficiary_wallet: {
      circle_wallet_id: BOB.circle_wallet_id,
      profiles: { id: BOB.profile_id, auth_user_id: "auth-p-bob" },
    },
  });

function submission(image: Blob = new Blob(["png-bytes"], { type: "image/png" })) {
  const form = new FormData();
  form.set("file", image, "work.png");
  form.set("circleContractId", "cc-1");
  return POST(new NextRequest("http://localhost/api/contracts/validate-work", { method: "POST", body: form }));
}

const aiSays = (result: { valid: boolean; confidence: string; reasons?: string[] }) =>
  openai.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ reasons: [], ...result }) } }],
  });

beforeEach(() => {
  user.from.mockReset();
  user.auth.getUser.mockReset();
  admin.from.mockReset();
  contractSdk.getContract.mockReset();
  walletSdk.createContractExecutionTransaction.mockReset();
  openai.chat.completions.create.mockReset();
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  user.storage.from.mockReturnValue({ upload });
  contractSdk.getContract.mockResolvedValue({
    data: { contract: { id: "cc-1", contractAddress: CONTRACT_ADDRESS } },
  });
  walletSdk.createContractExecutionTransaction.mockResolvedValue({
    data: { id: "circle-release-1", state: "INITIATED" },
  });
});

describe("POST /api/contracts/validate-work — who may submit work", () => {
  it("refuses a signed-out caller", async () => {
    signedOut(user);
    expect((await submission()).status).toBe(401);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it("refuses an oversized upload before any paid or wallet work", async () => {
    signedInAs(user, BOB, locked());
    const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" });
    expect((await submission(big)).status).toBe(413);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it("does not spend the AI call, or release funds, for the depositor", async () => {
    signedInAs(user, ALICE, locked());
    expect((await submission()).status).toBe(403);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });

  it("does not spend the AI call for a stranger", async () => {
    signedInAs(user, CAROL, null);
    expect((await submission()).status).toBe(404);
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it("does not accept work until the funds are locked (or after release)", async () => {
    for (const status of ["OPEN", "PENDING", "CLOSED"]) {
      signedInAs(user, BOB, { ...locked(), status });
      expect((await submission()).status).toBe(409);
    }
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/contracts/validate-work — releasing funds", () => {
  it("releases the funds from the beneficiary's wallet when the work is validated", async () => {
    signedInAs(user, BOB, locked(), { transactions: [queryBuilder({ data: { id: "tx-new" } })] });
    const update = adminUpdatesAgreement(admin);
    aiSays({ valid: true, confidence: "HIGH" });

    const res = await submission();

    expect(res.status).toBe(200);
    expect(walletSdk.createContractExecutionTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: BOB.circle_wallet_id,
        contractAddress: CONTRACT_ADDRESS,
        abiFunctionSignature: "withdraw(uint256[])",
      })
    );
    expect(update.update).toHaveBeenCalledWith({ status: "PENDING" });
  });

  it.each([
    ["invalid", { valid: false, confidence: "HIGH" }],
    ["only medium confidence", { valid: true, confidence: "MEDIUM" }],
    ["low confidence", { valid: true, confidence: "LOW" }],
  ])("does not release funds when the AI says the work is %s", async (_name, verdict) => {
    signedInAs(user, BOB, locked());
    aiSays({ ...verdict, reasons: ["Not what was asked"] });

    const res = await submission();

    expect(res.status).toBe(400);
    expect(walletSdk.createContractExecutionTransaction).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
  });
});
