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
import type { Blockchain } from "@circle-fin/smart-contract-platform";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { circleContractSdk } from "@/lib/utils/smart-contract-platform-client";
import {
  BLOCKCHAIN,
  REFUND_PROTOCOL_ABI_JSON,
  REFUND_PROTOCOL_BYTECODE,
  USDC_CONTRACT_ADDRESS,
} from "@/lib/constants";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { authorizeAgreementAction, setAgreementStatus } from "@/lib/auth/agreement-access";
import { getAuthenticatedUser, unauthorized } from "@/lib/auth/session";
import { isTransactionVisibleTo } from "@/lib/circle/wallet-data";

// Only `agreement.id` is used. Wallet addresses, amounts and the like are read from
// the database, never trusted from the request.
interface CreateEscrowRequest {
  agreement?: { id?: string };
  agentAddress?: string;
  amountUSDC?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shape of errors thrown by the Circle SDK's HTTP client
type HttpError = { response?: { status?: number; data?: unknown } };

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
    } catch (error) {
      console.error("Error checking transaction status:", error);
      if ((error as HttpError).response?.status === 404) {
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
  let claimedAgreementId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const body: CreateEscrowRequest = await req.json().catch(() => ({}));

    if (!process.env.NEXT_PUBLIC_AGENT_WALLET_ID || !process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS) {
      return NextResponse.json(
        { error: "The agent wallet is not configured" },
        { status: 500 }
      );
    }

    const agreementId = body.agreement?.id;
    if (typeof agreementId !== "string" || !UUID.test(agreementId)) {
      return NextResponse.json(
        { error: "Missing required agreement id" },
        { status: 400 }
      );
    }

    // Deploying spends the platform's agent wallet, so it must be the depositor of
    // an agreement that has not been deployed yet.
    const access = await authorizeAgreementAction<{
      id: string;
      transaction_id: string;
      depositor_wallet: { wallet_address: string };
      beneficiary_wallet: { wallet_address: string };
    }>(supabase, {
      by: { id: agreementId },
      role: "depositor",
      statuses: ["INITIATED"],
      select: `*,
        depositor_wallet:wallets!escrow_agreements_depositor_wallet_id_fkey (wallet_address),
        beneficiary_wallet:wallets!escrow_agreements_beneficiary_wallet_id_fkey (wallet_address)`,
    });
    if (!access.ok) return access.response;
    const agreement = access.agreement;

    // Claim the agreement before deploying, atomically: two quick clicks (or two
    // tabs) must not deploy two contracts and spend the agent wallet twice.
    if (!(await setAgreementStatus(agreement.id, "PENDING", ["INITIATED"]))) {
      return NextResponse.json(
        { error: "This agreement is already being deployed" },
        { status: 409 }
      );
    }
    claimedAgreementId = agreement.id;

    const createResponse = await circleContractSdk.deployContract({
      name: `Refund Protocol Escrow ${agreement.beneficiary_wallet.wallet_address}`,
      description: `Refund Protocol Escrow ${agreement.beneficiary_wallet.wallet_address}`,
      walletId: process.env.NEXT_PUBLIC_AGENT_WALLET_ID,
      blockchain: BLOCKCHAIN as Blockchain,
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        },
      },
      constructorParameters: [
        process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS,
        USDC_CONTRACT_ADDRESS,
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

    // Record the Circle ids so the webhook can find the agreement and transaction
    // later. Users cannot write these columns, so this uses the secret key.
    const admin = createSupabaseAdminClient();

    const { error: agreementError } = await admin
      .from("escrow_agreements")
      .update({ circle_contract_id: createResponse.data.contractId })
      .eq("id", agreement.id);

    if (agreementError) {
      throw new Error("Failed to update Circle contract ID")
    }

    const { error: transactionError } = await admin
      .from("transactions")
      .update({ circle_transaction_id: createResponse.data.transactionId })
      .eq("id", agreement.transaction_id);

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
          depositor: agreement.depositor_wallet.wallet_address,
          beneficiary: agreement.beneficiary_wallet.wallet_address,
          agent: process.env.NEXT_PUBLIC_AGENT_WALLET_ADDRESS,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating escrow:", error);

    // Nothing was deployed if we never got a contract id, so let them try again.
    if (claimedAgreementId) {
      await setAgreementStatus(claimedAgreementId, "INITIATED", ["PENDING"]);
    }

    return NextResponse.json(
      {
        error: "Failed to create escrow contract",
        details: (error as HttpError).response?.data || getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getAuthenticatedUser(supabase);
    if (!user) return unauthorized();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || !UUID.test(id)) {
      return NextResponse.json(
        { error: "A valid transaction ID is required" },
        { status: 400 }
      );
    }

    // Only poll a transaction the caller can see; otherwise this is a free way to
    // make the server hammer Circle for anyone.
    if (!(await isTransactionVisibleTo(supabase, id))) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
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
  } catch (error) {
    console.error("Error checking transaction status:", error);
    return NextResponse.json(
      {
        error: "Failed to get transaction status",
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
