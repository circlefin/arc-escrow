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

import type { Blockchain, WalletSet, Wallet } from "@circle-fin/developer-controlled-wallets";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";

export async function createWalletSet(entityName: string): Promise<WalletSet> {
  const response = await circleDeveloperSdk.createWalletSet({ name: entityName });

  if (!response.data?.walletSet) {
    throw new Error("The response did not include a valid wallet set");
  }

  return response.data.walletSet;
}

export async function createWallet(walletSetId: string): Promise<Wallet> {
  if (!process.env.CIRCLE_BLOCKCHAIN) {
    throw new Error("CIRCLE_BLOCKCHAIN environment variable is not set");
  }

  const response = await circleDeveloperSdk.createWallets({
    accountType: "SCA",
    blockchains: [process.env.CIRCLE_BLOCKCHAIN as Blockchain],
    count: 1,
    walletSetId,
  });

  if (!response.data?.wallets?.length) {
    throw new Error("No wallets were created");
  }

  return response.data.wallets[0];
}
