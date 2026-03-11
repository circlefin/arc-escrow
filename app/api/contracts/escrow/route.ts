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

import type { Blockchain } from "@circle-fin/smart-contract-platform";
import type { EscrowAgreementWithDetails } from "@/types/escrow";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { circleContractSdk } from "@/lib/utils/smart-contract-platform-client";
import { REFUND_PROTOCOL_BYTECODE, REFUND_PROTOCOL_ABI_JSON } from "@/lib/constants";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
//import { convertUSDCToContractAmount } from "@/lib/utils/amount";

interface CreateEscrowRequest {
  agreement: EscrowAgreementWithDetails;
  agentAddress: string;
  amountUSDC: number;
}

async function waitForTransactionStatus(id: string) {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const response = await circleDeveloperSdk.getTransaction({ id });

      if (!response.data) {
        throw new Error("No data returned from transaction status check");
      }

      console.log("Transaction status response:", response.data);

      const status = response.data.transaction?.state;
      if (status === "COMPLETE") return response.data;
      if (status === "FAILED") {
        throw new Error(
          `Transaction failed: ${response.data.transaction?.errorReason || "Unknown error"}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    } catch (error: any) {
      console.error("Error checking transaction status:", error);
      if (error.response?.status === 404) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error("Transaction status check timeout");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const body: CreateEscrowRequest = await req.json();

    // Validate request
    if (
      !body.agreement.depositor_wallet?.wallet_address ||
      !body.agreement.beneficiary_wallet?.wallet_address ||
      !body.agentAddress ||
      !body.amountUSDC
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate Ethereum addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (
      !addressRegex.test(body.agreement.depositor_wallet?.wallet_address) ||
      !addressRegex.test(body.agreement.beneficiary_wallet?.wallet_address) ||
      !addressRegex.test(body.agentAddress)
    ) {
      return NextResponse.json(
        { error: "Invalid Ethereum address format" },
        { status: 400 }
      );
    }

    if (!process.env.CIRCLE_BLOCKCHAIN) {
      throw new Error("CIRCLE_BLOCKCHAIN environment variable is not set");
    }

    if (!process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS) {
      throw new Error("NEXT_PUBLIC_USDC_CONTRACT_ADDRESS environment variable is not set");
    }

    // Create contract execution transaction
    const createResponse = await circleContractSdk.deployContract({
      name: `Refund Protocol Escrow ${body.agreement.beneficiary_wallet?.wallet_address}`,
      description: `Refund Protocol Escrow ${body.agreement.beneficiary_wallet?.wallet_address}`,
      walletId: process.env.NEXT_PUBLIC_AGENT_WALLET_ID,
      blockchain: process.env.CIRCLE_BLOCKCHAIN as Blockchain,
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        },
      },
      constructorParameters: [
        process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS,
        process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS,
        "EscrowProtocol", // EIP-712 name
        "1.0" // EIP-712 version
      ],
      abiJson: REFUND_PROTOCOL_ABI_JSON,
      bytecode: REFUND_PROTOCOL_BYTECODE,
    });

    if (!createResponse.data) {
      throw new Error("No data returned from transaction creation");
    }

    console.log("Transaction created:", createResponse.data);

    // Update circle_contract_id and move status to PENDING
    // This is needed so we can find the agreement later on to deposit funds to it
    const { error: agreementError } = await supabase
      .from("escrow_agreements")
      .update({
        circle_contract_id: createResponse.data.contractId,
        status: "PENDING",
      })
      .eq("id", body.agreement.id);

    if (agreementError) {
      throw new Error("Failed to update Circle contract ID")
    }

    // Update circle_transaction_id (is "NULL" by default on creation)
    // This is needed so we can find the transaction later on and update it's status
    const { error: transactionError } = await supabase
      .from("transactions")
      .update({ circle_transaction_id: createResponse.data.transactionId })
      .eq("id", body.agreement.transaction_id);

    if (transactionError) {
      throw new Error("Failed to update Circle transaction ID");
    }

    return NextResponse.json(
      {
        success: true,
        id: createResponse.data.contractId,
        transactionId: createResponse.data.transactionId,
        status: "PENDING",
        message: "Escrow contract creation initiated",
        addresses: {
          depositor: body.agreement.depositor_wallet?.wallet_address,
          beneficiary: body.agreement.beneficiary_wallet?.wallet_address,
          agent: body.agentAddress,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating escrow:", error);
    return NextResponse.json(
      {
        error: "Failed to create escrow contract",
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    const transactionStatus = await waitForTransactionStatus(id);

    return NextResponse.json(
      {
        success: true,
        status: transactionStatus.transaction?.state,
        transaction: transactionStatus,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error checking transaction status:", error);
    return NextResponse.json(
      {
        error: "Failed to get transaction status",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
