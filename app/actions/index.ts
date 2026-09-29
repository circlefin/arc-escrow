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

import { getErrorMessage } from "@/lib/utils/utils";
import { encodedRedirect } from "@/lib/flash-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { createUserWallet } from "@/lib/utils/create-user-wallet";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const companyName = formData.get("company-name")?.toString().trim();
  const fullName = formData.get("full-name")?.toString().trim();
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin");

  if (fullName && (fullName.length < 3 || fullName.length > 255)) {
    return encodedRedirect("error", "/sign-up", "Full name must be between 3 and 255 characters");
  }

  if (companyName && (companyName.length < 3 || companyName.length > 255)) {
    return encodedRedirect("error", "/sign-up", "Company name must be between 3 and 255 characters");
  }

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", "Email and password are required");
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

  const newUser = authData.user;

  if (!newUser) {
    return encodedRedirect("error", "/sign-up", "Could not create your account");
  }

  // Uses the secret key: a new user has no session until they confirm their email.
  const supabaseAdmin = createSupabaseAdminClient();

  try {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        email,
        full_name: fullName,
        company_name: companyName
      })
      .eq("auth_user_id", newUser.id)
      .select()
      .single();

    if (profileError) {
      console.error("Could not save the new profile:", profileError);
      throw new Error("Could not save your profile");
    }

    await createUserWallet(profileData.id, email);
  } catch (error) {
    // Roll back so the email can be reused instead of stranding a walletless account.
    await supabase.auth.signOut();
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(newUser.id);

    if (deleteError) {
      console.error("Could not remove the incomplete account:", deleteError);
    }

    return encodedRedirect("error", "/sign-up", getErrorMessage(error));
  }

  return redirect("/dashboard");
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createSupabaseServerClient();

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
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/dashboard/reset-password`,
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
  const supabase = await createSupabaseServerClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  return encodedRedirect("success", "/dashboard/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};
