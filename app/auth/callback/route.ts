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
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { createUserWallet } from "@/lib/utils/create-user-wallet";
import { FLASH_COOKIE, createFlashMessage, flashCookieOptions } from "@/lib/flash-message";
import { NextResponse } from "next/server";

/**
 * `next` comes from the query string, so only accept a path on this site.
 * "//evil.com" and "https://evil.com" are rejected; anything odd goes home.
 */
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/";
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");

  // Redirect within the origin that received the request. The old base URL came from
  // NEXT_PUBLIC_VERCEL_URL, which Vercel sets without a protocol ("app.vercel.app").
  const nextUrl = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // `email` is not writable by users (it identifies them in the recipient picker),
      // so sync it from the verified auth user with the secret key.
      const { data: user, error: userIdError } = await createSupabaseAdminClient()
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
        return NextResponse.redirect(new URL(nextUrl, origin));
      }

      try {
        await createUserWallet(user.id, data.user.email ?? data.user.id);
      } catch (walletError) {
        // Sign out so the next sign-in comes back here and tries again
        await supabase.auth.signOut();
        const message = walletError instanceof Error ? walletError.message : "Could not create your wallet";
        const response = NextResponse.redirect(new URL("/sign-in", origin));
        response.cookies.set(FLASH_COOKIE, createFlashMessage("error", message), flashCookieOptions);
        return response;
      }

      return NextResponse.redirect(new URL(nextUrl, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-error", origin));
}