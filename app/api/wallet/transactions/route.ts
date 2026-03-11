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

import { type NextRequest, NextResponse } from "next/server";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";
import { z } from "zod";

const WalletIdSchema = z.object({
  walletId: z.string().uuid(),
});

const ResponseSchema = z.object({
  transactions: z
    .array(
      z.object({
        id: z.string(),
        amount: z.array(z.string()),
        status: z.string(),
        transactionType: z.string(),
        createDate: z.string(),
        circleContractAddress: z.string().optional()
      }),
    )
    .optional(),
  error: z.string().optional(),
});

export type WalletTransactionsResponse = z.infer<typeof ResponseSchema>;

if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
  throw new Error(
    "Missing required environment variables: CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be defined",
  );
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<WalletTransactionsResponse>> {
  try {
    const body = await req.json();
    const parseResult = WalletIdSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid walletId format" },
        { status: 400 },
      );
    }

    const { walletId } = parseResult.data;

    const response = await circleDeveloperSdk.listTransactions({
      walletIds: [walletId],
      includeAll: true,
    });

    if (
      !response.data?.transactions ||
      response.data.transactions.length === 0
    ) {
      return NextResponse.json({ transactions: [] });
    }

    return NextResponse.json({
      transactions: response.data.transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amounts || [],
        status: tx.state,
        transactionType: tx.transactionType,
        createDate: tx.createDate,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 },
      );
    }

    console.error("Error fetching transactions from wallet:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Internal server error while fetching transactions" },
      { status: 500 },
    );
  }
}
