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

import { NextResponse } from "next/server";
import { createOnrampServerKit } from "@crcl-main/onramp-kit/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { API_BASE_URL, ENVIRONMENT } from "@/lib/server-environment";
import { WIDGET_BASE_URL } from "@/lib/onramp-environment";

// server-environment already refuses to start on mismatched base URLs, so this only catches a missing key.
const apiKey = process.env.CIRCLE_API_KEY?.trim();

if (!apiKey) {
  throw new Error(
    `CIRCLE_API_KEY is not set. Add the ${ENVIRONMENT} API key from the Circle ` +
      "console, in the form <ENV>_API_KEY:<keyId>:<keySecret>.",
  );
}

// Undefined leaves the kit on its mainnet defaults, which move real money.
const onrampServer = createOnrampServerKit({
  apiKey,
  baseUrl: API_BASE_URL,
  widgetBaseUrl: WIDGET_BASE_URL,
});

// The destination comes from the signed-in user's wallet, never from the request body.
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Could not retrieve the currently logged in user id:", profileError);
      return NextResponse.json(
        { error: "Could not retrieve the currently logged in user id" },
        { status: 500 },
      );
    }

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("wallet_address")
      .eq("profile_id", profile.id)
      .single();

    if (walletError || !wallet?.wallet_address) {
      console.error("Could not find a wallet for the current user", walletError);
      return NextResponse.json(
        { error: "Could not find a wallet for the current user" },
        { status: 500 },
      );
    }

    const session = await onrampServer.createSession({
      // Display scoping only (USDC on Arc); Circle's catalog stays the source of truth.
      assets: { tokens: ["USDC"], chains: ["arc"] },
      userId: user.id,
      destinationAddress: wallet.wallet_address,
    });

    return NextResponse.json(session, {
      // Session tokens are short-lived and single-use. Never cache them.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Failed to create an onramp session", error);
    return NextResponse.json(
      { error: "Failed to create an onramp session" },
      { status: 500 },
    );
  }
}
