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
import { NextRequest, NextResponse } from "next/server";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";

export async function POST(req: NextRequest) {
  try {
    const { walletSetId } = await req.json();

    if (!walletSetId) {
      return NextResponse.json(
        { error: "walletSetId is required" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: "No wallets were created" },
        { status: 500 }
      );
    }

    const [createdWallet] = response.data.wallets;

    return NextResponse.json(createdWallet, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create wallet: ${message}` },
      { status: 500 }
    );
  }
}
