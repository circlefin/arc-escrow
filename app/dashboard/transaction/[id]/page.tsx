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

import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getCircleTransactionVisibleTo } from "@/lib/circle/wallet-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Transaction(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;

  // Read on the server, as the signed-in user: a fetch to our own API would not
  // carry their cookies, and the API now requires them.
  const supabase = await createSupabaseServerClient();
  const transaction = UUID.test(params.id)
    ? await getCircleTransactionVisibleTo(supabase, params.id).catch(() => null)
    : null;

  if (!transaction) {
    return (
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
        Invalid transaction
      </h2>
    );
  }

  const transactionCreationTimestamp = new Date(
    transaction.createDate,
  );
  const creationDate = transactionCreationTimestamp.toLocaleDateString();
  const creationTime = transactionCreationTimestamp.toLocaleTimeString();

  const transactionLastUpdateTimestamp = new Date(
    transaction.updateDate,
  );
  const lastUpdateDate = transactionLastUpdateTimestamp.toLocaleDateString();
  const lastUpdateTime = transactionLastUpdateTimestamp.toLocaleTimeString();

  return (
    <>
      <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight mb-4 first:mt-0">
        Transaction details
      </h2>
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">ID</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {transaction.id}
      </p>
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Amount transferred
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {transaction.amounts?.[0]}
      </p>
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        State
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {transaction.state}
      </p>
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Creation date
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {creationDate} {creationTime}
      </p>
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Blockchain
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {transaction.blockchain}
      </p>
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Transaction type
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {transaction.transactionType}
      </p>
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Last updated
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {lastUpdateDate} {lastUpdateTime}
      </p>
    </>
  );
}
