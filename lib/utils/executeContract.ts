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

import { FeeLevel } from "@circle-fin/developer-controlled-wallets";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";

type ContractExecutionOptions = {
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: (string | number | boolean)[];
  feeLevel?: FeeLevel;
};

export const executeContract = async ({
  walletId,
  contractAddress,
  abiFunctionSignature,
  abiParameters,
  feeLevel = "MEDIUM",
}: ContractExecutionOptions) => {
  try {
    const response = await circleDeveloperSdk.createContractExecutionTransaction({
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters,
      fee: {
        type: "level",
        config: {
          feeLevel,
        },
      },
    });

    if (!response.data?.id) {
      throw new Error("No transaction ID was returned");
    }

    return {
      transactionId: response.data.id,
      status: response.data.state,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to execute contract: ${message}`);
  }
};

// Example usage:
/*
await executeContract({
  walletId: "wallet_123",
  contractAddress: "0x1234...5678",
  abiFunctionSignature: "transfer(address,uint256)",
  abiParameters: ["0xabcd...efgh", "1000000000000000000"],
  feeLevel: "HIGH"
});
*/
