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
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getAuthenticatedUser, unauthorized } from "@/lib/auth/session";
import { getCircleTransactionVisibleTo } from "@/lib/circle/wallet-data";

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
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse<TransactionResponse>> {
  const params = await props.params;
  try {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(params.id)) {
      return NextResponse.json(
        { error: "Invalid transaction ID format" },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const user = await getAuthenticatedUser(supabase);
    if (!user) return unauthorized() as NextResponse<TransactionResponse>;

    // Only a transaction the user can see (their own, or one on their agreements).
    const transaction = await getCircleTransactionVisibleTo(supabase, params.id);
    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    const parseResult = ResponseSchema.safeParse({ transaction });
    if (!parseResult.success) {
      console.error("Response validation failed:", parseResult.error);
      return NextResponse.json(
        { error: "Invalid response from Circle API" },
        { status: 500 },
      );
    }

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
