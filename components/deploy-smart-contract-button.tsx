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

"use client";

import type { EscrowAgreementWithDetails } from "@/types/escrow";
import { useSmartContract } from "@/app/hooks/useSmartContract";
import { Button } from "@/components/ui/button";
import { SYSTEM_AGENT_ADDRESS, SYSTEM_AGENT_WALLET_ID, USDC_CONTRACT_ADDRESS } from "@/lib/constants";
import { Loader2, WalletCards } from "lucide-react";
import { toast } from "sonner";

interface CreateSmartContractButtonProps {
  agreement: EscrowAgreementWithDetails
  disabled?: boolean;
}

export const CreateSmartContractButton = ({
  agreement,
  disabled,
}: CreateSmartContractButtonProps) => {
  const { createSmartContract, isLoading } = useSmartContract();

  const handleCreateSmartContract = async () => {
    if (!SYSTEM_AGENT_ADDRESS || !SYSTEM_AGENT_WALLET_ID || !USDC_CONTRACT_ADDRESS) {
      toast.error("Configuration Error", {
        description:
          "System is not properly configured. Please check your environment variables.",
      });
      return;
    }

    const amountUSDC = agreement.terms.amounts && agreement.terms.amounts.length > 0
      ? parseFloat(agreement.terms.amounts[0]?.amount.replace(/[$,]/g, ""))
      : undefined;

    if (!amountUSDC) {
      toast.error("Invalid amount for the contract", {
        description:
          "Amount for the contract should be between 0 and 15552000",
      });
      return;
    }

    try {
      await createSmartContract({
        agreement,
        agentAddress: SYSTEM_AGENT_ADDRESS,
        agentWalletId: SYSTEM_AGENT_WALLET_ID,
        amountUSDC,
      });
    } catch (error) {
      toast.error("Failed to create smart contract", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <Button
      onClick={handleCreateSmartContract}
      disabled={
        isLoading ||
        disabled ||
        !SYSTEM_AGENT_ADDRESS ||
        !SYSTEM_AGENT_WALLET_ID ||
        !USDC_CONTRACT_ADDRESS
      }
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        <>
          <WalletCards className="mr-2 h-4 w-4" />
          Create Smart Contract
        </>
      )}
    </Button>
  );
};
