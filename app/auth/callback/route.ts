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

import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");

  const nextUrl = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: user, error: userIdError } = await supabase
        .from("profiles")
        .update({ email: data.user.email })
        .eq("auth_user_id", data.user.id)
        .select("id")
        .single();

      if (userIdError) {
        console.error("Could not find an user with such auth_user_id", userIdError);
        return NextResponse.json(
          { message: "Could not find an user with such auth_user_id" },
          { status: 500 }
        );
      }

      const { data: walletAlreadyExists } = await supabase
        .from("wallets")
        .select()
        .eq("profile_id", user.id)
        .single();

      if (walletAlreadyExists) {
        return NextResponse.redirect(`${baseUrl}/${nextUrl}`);
      }

      const createdWalletSetResponse = await fetch(`${baseUrl}/api/wallet-set`, {
        method: "PUT",
        body: JSON.stringify({
          entityName: data.user.email,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const createdWalletSet = await createdWalletSetResponse.json();

      const createdWalletResponse = await fetch(`${baseUrl}/api/wallet`, {
        method: "POST",
        body: JSON.stringify({
          walletSetId: createdWalletSet.id,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const createdWallet = await createdWalletResponse.json();

      await supabase
        .schema("public")
        .from("wallets")
        .upsert({
          profile_id: user.id,
          circle_wallet_id: createdWallet.id,
          wallet_type: createdWallet.custodyType,
          wallet_set_id: createdWalletSet.id,
          wallet_address: createdWallet.address,
          account_type: createdWallet.accountType,
          blockchain: createdWallet.blockchain,
          currency: "USDC"
        });

      return NextResponse.redirect(`${baseUrl}/${nextUrl}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/auth-error`);
}