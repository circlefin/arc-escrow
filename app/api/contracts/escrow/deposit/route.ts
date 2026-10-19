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

interface DepositRequest {
  circleContractId: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const agreementService = createAgreementService(supabase);
    const body: DepositRequest = await req.json().catch(() => ({} as DepositRequest));

    // Only the depositor pays into the escrow, and only from their own wallet.
    // The agreement is PENDING once the approval has been sent, OPEN before that.
    const access = await authorizeAgreementAction<{
      id: string;
      circle_contract_id: string;
      terms: { amounts: { amount: string; for?: string }[] };
      beneficiary_wallet: { wallet_address: string };
      transactions: { amount: number };
    }>(supabase, {
      by: { circleContractId: body.circleContractId },
      role: "depositor",
      statuses: ["OPEN", "PENDING"],
      select: `*,
        beneficiary_wallet:wallets!escrow_agreements_beneficiary_wallet_id_fkey (
          wallet_address
        ),
        transactions:transactions!escrow_agreements_transaction_id_fkey (
          amount,
          currency,
          status,
          circle_contract_address
        )`,
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

    const contractAmount = Number(convertUSDCToContractAmount(contractTransaction.transactions.amount));

    const circleDepositResponse = await circleDeveloperSdk.createContractExecutionTransaction({
      walletId: depositorWallet.circle_wallet_id,
      contractAddress,
      abiFunctionSignature: "pay(address,uint256,address)",
      abiParameters: [
        contractTransaction.beneficiary_wallet.wallet_address,
        contractAmount,
        depositorWallet.wallet_address
      ],
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        },
      },
    });

    console.log("Funds deposit transaction created:", circleDepositResponse.data);

    const amount = parseAmount(contractTransaction.terms.amounts?.[0].amount);
    await agreementService.createTransaction({
      walletId: depositorWallet.id,
      circleTransactionId: circleDepositResponse.data?.id,
      escrowAgreementId: contractTransaction.id,
      transactionType: "DEPOSIT_PAYMENT",
      profileId: depositorWallet.profile_id,
      amount,
      description: contractTransaction.terms.amounts?.[0]?.for || "Funds deposited by depositor",
    });

    await setAgreementStatus(contractTransaction.id, "PENDING");

    return NextResponse.json(
      {
        success: true,
        transactionId: circleDepositResponse.data?.id,
        status: circleDepositResponse.data?.state,
        message: "Funds deposit transaction initiated"
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error during funds deposit initialization:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate funds deposit",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
