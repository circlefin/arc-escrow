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

import { config } from "dotenv";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from 'fs';
import path from 'path';

config({ path: [".env.local"] })

const requiredEnvVars = ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

export const circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

try {
  const createdWalletSetResponse = await circleDeveloperSdk.createWalletSet({
    name: "Escrow Agent Wallet"
  });

  const walletSetId = createdWalletSetResponse.data.walletSet.id;
  console.log(`Created wallet set with ID: ${walletSetId}`);

  const createdWalletResponse = await circleDeveloperSdk.createWallets({
    accountType: "SCA",
    // Keep in step with BLOCKCHAIN in lib/constants.ts; plain node cannot import it.
    blockchains: ["ARC-TESTNET"],
    walletSetId
  });

  const [createdWallet] = createdWalletResponse.data.wallets;
  if (!createdWallet) {
    throw new Error('No wallet was created');
  }

  console.log(`Agent wallet created successfully. Address: ${createdWallet.address}, ID: ${createdWallet.id}`);

  const envPath = path.resolve('.env.local');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  envContent = envContent.replace(/^NEXT_PUBLIC_AGENT_WALLET_ID=.*$/m, `NEXT_PUBLIC_AGENT_WALLET_ID=${createdWallet.id}`);
  envContent = envContent.replace(/^NEXT_PUBLIC_AGENT_WALLET_ADDRESS=.*$/m, `NEXT_PUBLIC_AGENT_WALLET_ADDRESS=${createdWallet.address}`);

  fs.writeFileSync(envPath, envContent);
  console.log('Environment variables updated successfully in .env.local');
} catch (error) {
  console.error("Failed to create agent wallet:", error.message);
  process.exit(1);
}
