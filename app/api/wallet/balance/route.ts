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
  balance: z.string().optional(),
  error: z.string().optional(),
});

type WalletBalanceResponse = z.infer<typeof ResponseSchema>;

export async function POST(
  req: NextRequest,
): Promise<NextResponse<WalletBalanceResponse>> {
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

    const response = await circleDeveloperSdk.getWalletTokenBalance({
      id: walletId,
      includeAll: true,
    });

    const balance = response.data?.tokenBalances?.find(
      ({ token }) => token.symbol === "USDC",
    )?.amount;

    return NextResponse.json({ balance: balance || "0" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 },
      );
    }

    console.error("Error fetching balance from wallet:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Internal server error while fetching balance" },
      { status: 500 },
    );
  }
}
