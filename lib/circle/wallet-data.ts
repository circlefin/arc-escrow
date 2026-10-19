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

import type { SupabaseClient } from "@supabase/supabase-js";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";

/** USDC balance of a Circle wallet, as a decimal string ("0" if it holds none). */
export async function getUsdcBalance(circleWalletId: string): Promise<string> {
  const response = await circleDeveloperSdk.getWalletTokenBalance({
    id: circleWalletId,
    includeAll: true,
  });

  return (
    response.data?.tokenBalances?.find(({ token }) => token.symbol === "USDC")
      ?.amount ?? "0"
  );
}

/** A Circle transaction, trimmed to what the app shows. Null if Circle has none. */
export async function getCircleTransaction(id: string) {
  const response = await circleDeveloperSdk.getTransaction({ id });
  const transaction = response.data?.transaction;
  if (!transaction) return null;

  return {
    id: transaction.id,
    amounts: transaction.amounts,
    state: transaction.state,
    createDate: transaction.createDate,
    blockchain: transaction.blockchain,
    transactionType: transaction.transactionType,
    updateDate: transaction.updateDate,
  };
}

/**
 * Whether the signed-in user may see this Circle transaction. Row level security
 * limits `transactions` to the user's own rows and those of the agreements they are
 * a party to, so knowing a Circle transaction id is not enough to read anything.
 * Database only: no call to Circle.
 */
export async function isTransactionVisibleTo(
  supabase: SupabaseClient,
  circleTransactionId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("circle_transaction_id", circleTransactionId)
    .limit(1);

  return (data?.length ?? 0) > 0;
}

/** getCircleTransaction, but only for a transaction the signed-in user can see. */
export async function getCircleTransactionVisibleTo(
  supabase: SupabaseClient,
  id: string
) {
  if (!(await isTransactionVisibleTo(supabase, id))) return null;
  return getCircleTransaction(id);
}
