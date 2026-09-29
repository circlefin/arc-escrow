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
import { queryBuilder, queueTables } from "../helpers/supabase-mock";
import { ALICE, BOB, CAROL, agreementRow, signedInAs, signedOut } from "../helpers/scenario";

const user = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }));
const admin = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin-client", () => ({ createSupabaseAdminClient: () => admin }));

import { authorizeAgreementAction, setAgreementStatus } from "@/lib/auth/agreement-access";

const authorize = (over: Partial<Parameters<typeof authorizeAgreementAction>[1]> = {}) =>
  authorizeAgreementAction(user as never, {
    by: { circleContractId: "cc-1" },
    role: "depositor",
    select: "*",
    ...over,
  });

const denied = async (result: Awaited<ReturnType<typeof authorize>>) => {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("unreachable");
  return { status: result.response.status, body: await result.response.json() };
};

beforeEach(() => {
  user.from.mockReset();
  user.auth.getUser.mockReset();
  admin.from.mockReset();
});

describe("authorizeAgreementAction", () => {
  it("answers 401 to a signed-out caller and reads nothing", async () => {
    signedOut(user);
    expect((await denied(await authorize())).status).toBe(401);
  });

  it("answers 400 when the agreement is not identified", async () => {
    signedInAs(user, ALICE, agreementRow());
    expect((await denied(await authorize({ by: { circleContractId: undefined } }))).status).toBe(400);
    expect((await denied(await authorize({ by: { id: 42 } }))).status).toBe(400);
  });

  it("answers 404 when the caller has no wallet", async () => {
    user.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-x" } } });
    queueTables(user, {
      profiles: [queryBuilder({ data: { id: "p-x" } })],
      wallets: [queryBuilder({ data: null })],
    });
    expect((await denied(await authorize())).status).toBe(404);
  });

  it("answers 404 for an agreement the caller cannot see (hidden by RLS)", async () => {
    signedInAs(user, CAROL, null);
    expect((await denied(await authorize())).status).toBe(404);
  });

  it("answers 403 when the caller is the wrong party", async () => {
    signedInAs(user, BOB, agreementRow());
    const { status, body } = await denied(await authorize({ role: "depositor" }));
    expect(status).toBe(403);
    expect(body.error).toMatch(/depositor/);

    signedInAs(user, ALICE, agreementRow());
    expect((await denied(await authorize({ role: "beneficiary" }))).status).toBe(403);
  });

  it("answers 403 to a party's counterpart even when the status is right", async () => {
    signedInAs(user, ALICE, agreementRow({ status: "LOCKED" }));
    expect((await denied(await authorize({ role: "beneficiary", statuses: ["LOCKED"] }))).status).toBe(403);
  });

  it("answers 409 when the agreement is in the wrong status", async () => {
    signedInAs(user, ALICE, agreementRow({ status: "LOCKED" }));
    const { status, body } = await denied(await authorize({ statuses: ["OPEN"] }));
    expect(status).toBe(409);
    expect(body.error).toMatch(/LOCKED/);
  });

  it("returns the caller's wallet and the agreement when everything lines up", async () => {
    signedInAs(user, ALICE, agreementRow());
    const result = await authorize({ statuses: ["OPEN", "PENDING"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.wallet).toMatchObject({ id: ALICE.id, circle_wallet_id: ALICE.circle_wallet_id });
    expect(result.agreement).toMatchObject({ id: "ag-1" });
  });

  it("can look an agreement up by id", async () => {
    signedInAs(user, ALICE, agreementRow({ status: "INITIATED" }));
    const result = await authorize({ by: { id: "ag-1" }, statuses: ["INITIATED"] });
    expect(result.ok).toBe(true);
  });
});

describe("setAgreementStatus", () => {
  it("updates through the admin client and reports success", async () => {
    const update = queryBuilder({ data: [{ id: "ag-1" }] });
    queueTables(admin, { escrow_agreements: [update] });
    expect(await setAgreementStatus("ag-1", "PENDING")).toBe(true);
    expect(update.update).toHaveBeenCalledWith({ status: "PENDING" });
    expect(update.in).not.toHaveBeenCalled();
  });

  it("only moves from the given statuses, and reports when it did not (atomic claim)", async () => {
    const lost = queryBuilder({ data: [] });
    queueTables(admin, { escrow_agreements: [lost] });
    expect(await setAgreementStatus("ag-1", "PENDING", ["INITIATED"])).toBe(false);
    expect(lost.in).toHaveBeenCalledWith("status", ["INITIATED"]);
  });

  it("reports failure on a database error", async () => {
    queueTables(admin, { escrow_agreements: [queryBuilder({ error: { message: "boom" } })] });
    expect(await setAgreementStatus("ag-1", "PENDING")).toBe(false);
  });
});
