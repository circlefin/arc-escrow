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

import { SupabaseClient } from "@supabase/supabase-js";
import { EscrowAgreementWithDetails } from "@/types/escrow";

export const createEscrowService = (supabase: SupabaseClient) => ({
  async getAgreements(
    profileId: string
  ): Promise<EscrowAgreementWithDetails[]> {
    const { data: profileWallet, error: walletError } = await supabase
      .from("wallets")
      .select("id")
      .eq("profile_id", profileId)
      .single();

    if (walletError) {
      console.error("Error fetching wallets:", walletError);
      throw new Error(`Failed to fetch wallets: ${walletError.message}`);
    }

    if (!profileWallet) {
      console.error("No wallets found for the current user.");
      throw new Error("No wallets found for the current user");
    }

    const { data, error } = await supabase
      .from("escrow_agreements")
      .select(
        `
    *,
    depositor_wallet:wallets!escrow_agreements_depositor_wallet_id_fkey (
      profile_id,
      wallet_address,
      profiles!wallets_profile_id_fkey (
        name,
        full_name,
        company_name,
        email,
        auth_user_id
      )
    ),
    beneficiary_wallet:wallets!escrow_agreements_beneficiary_wallet_id_fkey (
      profile_id,
      wallet_address,
      profiles!wallets_profile_id_fkey (
        name,
        full_name,
        email,
        company_name,
        auth_user_id
      )
    ),
    transactions:transactions!escrow_agreements_transaction_id_fkey (
      amount,
      currency,
      status,
      circle_contract_address
    )
  `
      )
      .or(
        `depositor_wallet_id.in.(${profileWallet.id}),beneficiary_wallet_id.in.(${profileWallet.id})`
      )
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch agreements: ${error.message}`);
    }

    // Modified data processing to keep both wallet details
    const filteredData = data?.map((agreement) => {
      const isDepositor = agreement.depositor_wallet?.profile_id === profileId;

      return {
        ...agreement,
        userRole: isDepositor ? "depositor" : "beneficiary", // Optional: Add role context
        depositor_wallet: agreement.depositor_wallet, // Keep original depositor wallet
        beneficiary_wallet: agreement.beneficiary_wallet, // Keep original beneficiary wallet
      };
    });

    return filteredData || [];
  },
});
