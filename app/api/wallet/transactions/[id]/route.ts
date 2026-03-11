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

const ResponseSchema = z.object({
  transaction: z
    .object({
      id: z.string(),
      amounts: z.array(z.string()).optional(),
      state: z.string(),
      createDate: z.string(),
      blockchain: z.string(),
      transactionType: z.string(),
      updateDate: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

type TransactionResponse = z.infer<typeof ResponseSchema>;

if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
  throw new Error(
    "Missing required environment variables: CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be defined",
  );
}

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse<TransactionResponse>> {
  try {
    // Validate the transaction ID is a Circle's transaction IDs
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(params.id)) {
      return NextResponse.json(
        { error: "Invalid transaction ID format" },
        { status: 400 },
      );
    }

    const response = await circleDeveloperSdk.getTransaction({
      id: params.id,
    });

    const parseResult = ResponseSchema.safeParse({
      transaction: response.data?.transaction,
    });
    if (!parseResult.success) {
      console.error("Response validation failed:", parseResult.error);
      return NextResponse.json(
        { error: "Invalid response from Circle API" },
        { status: 500 },
      );
    }

    if (!response.data || response.data.transaction === undefined) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }
    //Needs to be fixed
    const transaction: any = {
      id: response.data.transaction.id,
      amounts: response.data.transaction.amounts,
      state: response.data.transaction.state,
      createDate: response.data.transaction.createDate,
      blockchain: response.data.transaction.blockchain,
      transactionType: response.data.transaction.transactionType,
      updateDate: response.data.transaction.updateDate,
    };

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Error fetching transaction:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error while fetching transaction" },
      { status: 500 },
    );
  }
}
