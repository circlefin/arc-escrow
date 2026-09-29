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

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Validates the session with Supabase Auth (not just the cookie) and returns the
 * signed-in user, or null.
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export const unauthorized = () =>
  NextResponse.json({ error: "User is not authenticated" }, { status: 401 });

export const forbidden = (message = "You are not allowed to do this") =>
  NextResponse.json({ error: message }, { status: 403 });

export interface OwnWallet {
  id: string;
  profile_id: string;
  circle_wallet_id: string;
  wallet_address: string;
}

/**
 * The signed-in user's own profile and wallet. Route handlers use the wallet id
 * from here, never one supplied by the browser, to decide whose funds to move.
 */
export async function getOwnWallet(
  supabase: SupabaseClient,
  authUserId: string
): Promise<OwnWallet | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!profile) return null;

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, profile_id, circle_wallet_id, wallet_address")
    .eq("profile_id", profile.id)
    .maybeSingle();

  return (wallet as OwnWallet | null) ?? null;
}
