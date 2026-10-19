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

import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonymous,
  cleanup,
  createAgreement,
  createPerson,
  createTransaction,
  service,
  terms,
  type Person,
} from "./helpers";

afterAll(cleanup);

// Alice deposits, Bob is the beneficiary, Carol is a stranger.
let alice: Person;
let bob: Person;
let carol: Person;

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([createPerson(), createPerson(), createPerson()]);
});

const PERMISSION_DENIED = "42501";

describe("creating agreements", () => {
  it("lets a depositor create an INITIATED agreement funded by their own transaction", async () => {
    const transactionId = await createTransaction(alice);
    const { data, error } = await alice.client
      .from("escrow_agreements")
      .insert({
        depositor_wallet_id: alice.walletId,
        beneficiary_wallet_id: bob.walletId,
        transaction_id: transactionId,
        status: "INITIATED",
        terms: terms(),
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    await service.from("escrow_agreements").delete().eq("id", data!.id);
  });

  it.each([
    ["already LOCKED (skipping deposit and validation)", { status: "LOCKED" }],
    ["already OPEN", { status: "OPEN" }],
    ["with a contract id chosen by the client", { circle_contract_id: randomUUID() }],
  ])("rejects an agreement created %s", async (_name, overrides) => {
    const transactionId = await createTransaction(alice);
    const { error } = await alice.client.from("escrow_agreements").insert({
      depositor_wallet_id: alice.walletId,
      beneficiary_wallet_id: bob.walletId,
      transaction_id: transactionId,
      status: "INITIATED",
      terms: terms(),
      ...overrides,
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("rejects an agreement that points at someone else's transaction", async () => {
    const bobsTransaction = await createTransaction(bob);
    const { error } = await alice.client.from("escrow_agreements").insert({
      depositor_wallet_id: alice.walletId,
      beneficiary_wallet_id: bob.walletId,
      transaction_id: bobsTransaction,
      status: "INITIATED",
      terms: terms(),
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("rejects creating an agreement in someone else's name", async () => {
    const transactionId = await createTransaction(carol);
    const { error } = await carol.client.from("escrow_agreements").insert({
      depositor_wallet_id: alice.walletId, // not Carol's wallet
      beneficiary_wallet_id: bob.walletId,
      transaction_id: transactionId,
      status: "INITIATED",
      terms: terms(),
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe("editing agreements", () => {
  it("lets the depositor edit the terms before the contract is deployed", async () => {
    const agreement = await createAgreement(alice, bob);
    const newTerms = { ...terms(), tasks: ["Deliver a PNG logo", "And a favicon"] };

    const { data, error } = await alice.client
      .from("escrow_agreements")
      .update({ terms: newTerms })
      .eq("id", agreement.id)
      .select("terms");

    expect(error).toBeNull();
    expect(data).toEqual([{ terms: newTerms }]);
  });

  it("does NOT let the beneficiary rewrite the terms (tasks are what the AI validates against)", async () => {
    const agreement = await createAgreement(alice, bob);
    const { data } = await bob.client
      .from("escrow_agreements")
      .update({ terms: { amounts: terms().amounts, tasks: ["Upload any image"] } })
      .eq("id", agreement.id)
      .select("id");

    expect(data ?? []).toEqual([]);
    const { data: row } = await service.from("escrow_agreements").select("terms").eq("id", agreement.id).single();
    expect(row!.terms).toEqual(terms());
  });

  it("freezes the terms once the agreement is no longer INITIATED", async () => {
    const agreement = await createAgreement(alice, bob, { status: "LOCKED", circle_contract_id: randomUUID() });
    const { data } = await alice.client
      .from("escrow_agreements")
      .update({ terms: { amounts: [{ amount: "$0.01" }], tasks: [] } })
      .eq("id", agreement.id)
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it.each([
    ["status", { status: "LOCKED" }],
    ["circle_contract_id", { circle_contract_id: randomUUID() }],
    ["beneficiary_wallet_id", { beneficiary_wallet_id: "carol" }],
    ["depositor_wallet_id", { depositor_wallet_id: "carol" }],
  ])("does not let the depositor change %s directly", async (_column, patch) => {
    const agreement = await createAgreement(alice, bob);
    const value = Object.fromEntries(
      Object.entries(patch).map(([k, v]) => [k, v === "carol" ? carol.walletId : v])
    );

    const { error } = await alice.client.from("escrow_agreements").update(value).eq("id", agreement.id);

    expect(error?.code).toBe(PERMISSION_DENIED);
    const { data: row } = await service.from("escrow_agreements").select("*").eq("id", agreement.id).single();
    expect(row!.status).toBe("INITIATED");
    expect(row!.circle_contract_id).toBeNull();
    expect(row!.beneficiary_wallet_id).toBe(bob.walletId);
  });

  it("does not let the beneficiary or a stranger change the status", async () => {
    const agreement = await createAgreement(alice, bob);
    for (const person of [bob, carol]) {
      const { error, data } = await person.client
        .from("escrow_agreements")
        .update({ status: "CLOSED" })
        .eq("id", agreement.id)
        .select("id");
      expect(error?.code === PERMISSION_DENIED || (data ?? []).length === 0).toBe(true);
    }
    const { data: row } = await service.from("escrow_agreements").select("status").eq("id", agreement.id).single();
    expect(row!.status).toBe("INITIATED");
  });
});

describe("deleting agreements", () => {
  it("lets the depositor delete an agreement that was never deployed", async () => {
    const agreement = await createAgreement(alice, bob);
    const { data } = await alice.client.from("escrow_agreements").delete().eq("id", agreement.id).select("id");
    expect(data).toEqual([{ id: agreement.id }]);
  });

  it("does not let anyone delete an agreement with funds locked in a contract", async () => {
    const agreement = await createAgreement(alice, bob, { status: "LOCKED", circle_contract_id: randomUUID() });
    for (const person of [alice, bob, carol]) {
      const { data } = await person.client.from("escrow_agreements").delete().eq("id", agreement.id).select("id");
      expect(data ?? []).toEqual([]);
    }
    const { data: row } = await service.from("escrow_agreements").select("id").eq("id", agreement.id);
    expect(row).toHaveLength(1);
  });

  it("does not let the beneficiary delete even an INITIATED agreement", async () => {
    const agreement = await createAgreement(alice, bob);
    const { data } = await bob.client.from("escrow_agreements").delete().eq("id", agreement.id).select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("agreement visibility", () => {
  it("shows an agreement to its two parties only", async () => {
    const agreement = await createAgreement(alice, bob);
    for (const person of [alice, bob]) {
      const { data } = await person.client.from("escrow_agreements").select("id").eq("id", agreement.id);
      expect(data).toEqual([{ id: agreement.id }]);
    }
    const { data } = await carol.client.from("escrow_agreements").select("id").eq("id", agreement.id);
    expect(data).toEqual([]);
    const anon = await anonymous().from("escrow_agreements").select("id").eq("id", agreement.id);
    expect(anon.data ?? []).toEqual([]);
  });
});

describe("transactions", () => {
  it("lets a user record a transaction for their own wallet", async () => {
    const { error } = await alice.client.from("transactions").insert({
      wallet_id: alice.walletId,
      profile_id: alice.profileId,
      amount: 5,
      currency: "USDC",
      status: "COMPLETE",
      transaction_type: "INBOUND",
      circle_transaction_id: crypto.randomUUID(),
    });
    expect(error).toBeNull();
  });

  it("does not let a user record a transaction in someone else's name or wallet", async () => {
    const { error } = await carol.client.from("transactions").insert({
      wallet_id: alice.walletId,
      profile_id: alice.profileId,
      amount: 1_000_000,
      currency: "USDC",
      status: "COMPLETE",
      transaction_type: "INBOUND",
    });
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("does not let a user rewrite their own transaction afterwards", async () => {
    const id = await createTransaction(alice, { status: "FAILED", amount: 100 });
    const { error } = await alice.client
      .from("transactions")
      .update({ status: "COMPLETE", amount: 999999 })
      .eq("id", id);
    expect(error?.code).toBe(PERMISSION_DENIED);

    const { data: row } = await service.from("transactions").select("status, amount").eq("id", id).single();
    expect(row).toMatchObject({ status: "FAILED", amount: 100 });
  });

  it("shows an agreement's funding transaction to both parties but not to a stranger", async () => {
    const agreement = await createAgreement(alice, bob);
    for (const person of [alice, bob]) {
      const { data } = await person.client.from("transactions").select("id").eq("id", agreement.transaction_id);
      expect(data).toEqual([{ id: agreement.transaction_id }]);
    }
    const { data } = await carol.client.from("transactions").select("id").eq("id", agreement.transaction_id);
    expect(data).toEqual([]);
  });

  it("keeps an unrelated transaction private", async () => {
    const id = await createTransaction(alice);
    const { data } = await bob.client.from("transactions").select("id").eq("id", id);
    expect(data).toEqual([]);
  });
});

describe("profiles", () => {
  it("lets a user edit their display fields", async () => {
    const { error } = await alice.client
      .from("profiles")
      .update({ full_name: "Alice Example", company_name: "Alice Co" })
      .eq("id", alice.profileId);
    expect(error).toBeNull();
  });

  it("does not let a user change their email (it identifies them in the recipient picker)", async () => {
    const { error } = await carol.client
      .from("profiles")
      .update({ email: bob.email })
      .eq("id", carol.profileId);
    expect(error?.code).toBe(PERMISSION_DENIED);

    const { data } = await service.from("profiles").select("email").eq("id", carol.profileId).single();
    expect(data!.email).toBe(carol.email);
  });

  it("does not let a user re-point their profile at another account", async () => {
    const { error } = await carol.client
      .from("profiles")
      .update({ auth_user_id: alice.authId })
      .eq("id", carol.profileId);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("does not let a user edit someone else's profile", async () => {
    const { data } = await carol.client
      .from("profiles")
      .update({ full_name: "Hacked" })
      .eq("id", alice.profileId)
      .select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("internals", () => {
  it("keeps the private policy helpers out of the API", async () => {
    const { error } = await alice.client.rpc("owns_wallet", { p_wallet_id: alice.walletId });
    expect(error).not.toBeNull();
  });
});
