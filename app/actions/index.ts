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

"use server";

import { encodedRedirect } from "@/lib/utils/utils";
import { createClient } from "@/lib/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const companyName = formData.get("company-name")?.toString().trim();
  const fullName = formData.get("full-name")?.toString().trim();
  const supabase = createClient();
  const origin = headers().get("origin");

  if (fullName && (fullName.length < 3 || fullName.length > 255)) {
    return { error: "Full name must be between 3 and 255 characters" };
  }

  if (companyName && (companyName.length < 3 || companyName.length > 255)) {
    return { error: "Company name must be between 3 and 255 characters" };
  }

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { error, data: authData } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    console.error(error.code + " " + error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  }

  try {
    const createdWalletSetResponse = await fetch(`${baseUrl}/api/wallet-set`, {
      method: "PUT",
      body: JSON.stringify({
        entityName: email,
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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .update({
        email,
        full_name: fullName,
        company_name: companyName
      })
      .eq("auth_user_id", authData.user?.id)
      .select()
      .single();

    if (profileError) {
      console.error("Error while attempting to create user:", profileError);
      return { error: "Could not create user" };
    }

    const { error: walletError } = await supabase
      .schema("public")
      .from("wallets")
      .insert({
        profile_id: profileData.id,
        circle_wallet_id: createdWallet.id,
        wallet_type: createdWallet.custodyType,
        wallet_set_id: createdWalletSet.id,
        wallet_address: createdWallet.address,
        account_type: createdWallet.accountType,
        blockchain: createdWallet.blockchain,
        currency: "USDC",
      })
      .select();

    if (walletError) {
      console.error(
        "Error while attempting to create user's wallet:",
        walletError,
      );
      return { error: "Could not create wallet" };
    }
  } catch (error: any) {
    console.error(error.message);
    return { error: error.message };
  }

  return redirect("/dashboard");
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = createClient();

  const { data: user, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = createClient();
  const origin = headers().get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/dashboard/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/dashboard/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};
