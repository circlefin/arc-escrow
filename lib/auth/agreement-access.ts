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

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import {
  forbidden,
  getAuthenticatedUser,
  getOwnWallet,
  unauthorized,
  type OwnWallet,
} from "@/lib/auth/session";
import { roleInAgreement, type AgreementRole } from "@/lib/auth/agreement-role";

export type AgreementStatus =
  | "INITIATED"
  | "OPEN"
  | "PENDING"
  | "LOCKED"
  | "CLOSED";

interface Options {
  /** Which agreement: its `circle_contract_id` or its own `id`. */
  by: { circleContractId: unknown } | { id: unknown };
  /** The only party allowed to perform this action. */
  role: AgreementRole;
  /** Statuses the agreement may be in. Omit to allow any. */
  statuses?: AgreementStatus[];
  /** PostgREST select for the agreement. Must include both wallet id columns and `status`. */
  select: string;
}

type Result<T> =
  | { ok: true; user: User; wallet: OwnWallet; agreement: T }
  | { ok: false; response: NextResponse };

const fail = (response: NextResponse) => ({ ok: false as const, response });

/**
 * Everything a money-moving route must establish BEFORE it asks Circle to do
 * anything: who is calling, that they are the required party to this agreement,
 * and that the agreement is in a state where the action makes sense.
 *
 * The Circle call is made with the app's API key from a party's wallet, so the
 * database's row level security cannot stop it. Only this check can. It reads
 * through the user's own client, so an agreement the caller is not a party to is
 * simply "not found".
 */
export async function authorizeAgreementAction<T>(
  supabase: SupabaseClient,
  { by, role, statuses, select }: Options
): Promise<Result<T>> {
  const user = await getAuthenticatedUser(supabase);
  if (!user) return fail(unauthorized());

  const key = "circleContractId" in by ? "circle_contract_id" : "id";
  const value = "circleContractId" in by ? by.circleContractId : by.id;
  if (typeof value !== "string" || !value) {
    return fail(
      NextResponse.json(
        { error: `Missing required ${"circleContractId" in by ? "circleContractId" : "agreement id"}` },
        { status: 400 }
      )
    );
  }

  const wallet = await getOwnWallet(supabase, user.id);
  if (!wallet) {
    return fail(
      NextResponse.json(
        { error: "Could not find a wallet for the current user" },
        { status: 404 }
      )
    );
  }

  const { data, error } = await supabase
    .from("escrow_agreements")
    .select(select)
    .eq(key, value)
    .maybeSingle();

  if (error || !data) {
    return fail(
      NextResponse.json({ error: "Agreement not found" }, { status: 404 })
    );
  }

  const agreement = data as unknown as T & {
    depositor_wallet_id: string;
    beneficiary_wallet_id: string;
    status: AgreementStatus;
  };

  if (roleInAgreement(agreement, wallet.id) !== role) {
    return fail(forbidden(`Only the ${role} can do this`));
  }

  if (statuses && !statuses.includes(agreement.status)) {
    return fail(
      NextResponse.json(
        {
          error: `This agreement is ${agreement.status}; it must be ${statuses.join(" or ")} for this action`,
        },
        { status: 409 }
      )
    );
  }

  return { ok: true, user, wallet, agreement };
}

/**
 * Moves an agreement to a new status. Uses the secret key: users are not allowed
 * to change `status` themselves (see migration 20260918120000), so only server
 * code that has already authorized the action may.
 *
 * With `from`, only moves it if it is currently in one of those statuses, and
 * reports whether it did. That makes it an atomic claim.
 */
export async function setAgreementStatus(
  agreementId: string,
  status: AgreementStatus,
  from?: AgreementStatus[]
): Promise<boolean> {
  let query = createSupabaseAdminClient()
    .from("escrow_agreements")
    .update({ status })
    .eq("id", agreementId);

  if (from) query = query.in("status", from);

  const { data, error } = await query.select("id");
  if (error) {
    console.error(`Could not set agreement ${agreementId} to ${status}:`, error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
