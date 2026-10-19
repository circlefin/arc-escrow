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

import type { Blockchain } from "@circle-fin/developer-controlled-wallets";
import { BLOCKCHAIN } from "@/lib/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { getErrorMessage } from "@/lib/utils/utils";

export async function createUserWallet(profileId: string, entityName: string) {
  let walletSetId: string;
  let wallet;

  try {
    const walletSetResponse = await circleDeveloperSdk.createWalletSet({
      name: entityName,
    });

    const walletSet = walletSetResponse.data?.walletSet;
    if (!walletSet) throw new Error("No wallet set was returned");
    walletSetId = walletSet.id;

    const walletsResponse = await circleDeveloperSdk.createWallets({
      accountType: "SCA",
      blockchains: [BLOCKCHAIN as Blockchain],
      count: 1,
      walletSetId,
    });

    wallet = walletsResponse.data?.wallets?.[0];
    if (!wallet) throw new Error("No wallet was returned");
  } catch (error) {
    console.error(
      "Circle wallet creation failed. Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET:",
      error
    );
    throw new Error(
      `Could not create your wallet with Circle: ${getErrorMessage(error)}`,
      { cause: error }
    );
  }

  // Wallets can only be written with the secret key
  const { error: walletError } = await createSupabaseAdminClient()
    .from("wallets")
    .insert({
      profile_id: profileId,
      circle_wallet_id: wallet.id,
      wallet_type: wallet.custodyType,
      wallet_set_id: walletSetId,
      wallet_address: wallet.address,
      account_type: wallet.accountType,
      blockchain: wallet.blockchain,
      currency: "USDC",
    });

  if (walletError) {
    console.error("Could not save the new wallet:", walletError);
    throw new Error("Could not save your wallet", { cause: walletError });
  }
}
