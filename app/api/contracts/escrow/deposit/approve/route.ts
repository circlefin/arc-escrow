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

import { getErrorMessage } from "@/lib/utils/utils";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { circleContractSdk } from "@/lib/utils/smart-contract-platform-client";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { createAgreementService } from "@/app/services/agreement.service";
import { authorizeAgreementAction, setAgreementStatus } from "@/lib/auth/agreement-access";
import { convertUSDCToContractAmount, parseAmount } from "@/lib/utils/amount";
import { USDC_CONTRACT_ADDRESS } from "@/lib/constants";

interface DepositRequest {
  circleContractId: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const agreementService = createAgreementService(supabase);
    const body: DepositRequest = await req.json().catch(() => ({} as DepositRequest));

    // Only the depositor approves USDC spending, and only from their own wallet.
    const access = await authorizeAgreementAction<{
      id: string;
      circle_contract_id: string;
      terms: { amounts: { amount: string }[] };
    }>(supabase, {
      by: { circleContractId: body.circleContractId },
      role: "depositor",
      statuses: ["OPEN"],
      select: "*",
    });
    if (!access.ok) return access.response;
    const { wallet: depositorWallet, agreement: contractTransaction } = access;

    const contractData = await circleContractSdk.getContract({
      id: contractTransaction.circle_contract_id
    });

    if (!contractData.data) {
      console.error("Could not retrieve contract data");
      return NextResponse.json({ error: "Could not retrieve contract data" }, { status: 500 });
    }

    const contractAddress = contractData.data?.contract.contractAddress;

    if (!contractAddress) {
      return NextResponse.json({ error: "Could not retrieve contract address" }, { status: 500 })
    }

    const parsedAmount = parseAmount(contractTransaction.terms.amounts?.[0].amount);
    const contractAmount = Number(convertUSDCToContractAmount(parsedAmount))

    const circleApprovalResponse = await circleDeveloperSdk.createContractExecutionTransaction({
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [contractAddress, contractAmount],
      contractAddress: USDC_CONTRACT_ADDRESS,
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        }
      },
      walletId: depositorWallet.circle_wallet_id
    });

    await agreementService.createTransaction({
      walletId: depositorWallet.id,
      circleTransactionId: circleApprovalResponse.data?.id,
      escrowAgreementId: contractTransaction.id,
      transactionType: "DEPOSIT_APPROVAL",
      profileId: depositorWallet.profile_id,
      amount: Number(parsedAmount),
      description: "Request for deposit approval",
    });

    console.log("Deposit approval transaction created:", circleApprovalResponse.data);

    await setAgreementStatus(contractTransaction.id, "PENDING");

    return NextResponse.json(
      {
        success: true,
        transactionId: circleApprovalResponse.data?.id,
        status: circleApprovalResponse.data?.state,
        message: "Funds deposit approval initiated"
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error during deposit approval:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate deposit approval",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
