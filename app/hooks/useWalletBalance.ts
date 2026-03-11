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

"use client";

import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js";
import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";

interface UseWalletBalanceResult {
  balance: number;
  loading: boolean;
  refreshBalance: () => Promise<void>;
}

const supabase = createSupabaseBrowserClient()

export function useWalletBalance(walletId: string): UseWalletBalanceResult {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true);
      const balanceResponse = await fetch('/api/wallet/balance', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletId })
      });

      const parsedBalance = await balanceResponse.json();

      if (parsedBalance.error) {
        console.error("Error fetching wallet balance:", parsedBalance.error);
        toast.error("Error fetching wallet balance", {
          description: parsedBalance.error
        });
        return;
      }

      if (parsedBalance.balance === null || parsedBalance.balance === undefined) {
        console.log("Wallet has no balance");
        toast.info("Wallet has no balance");
        setBalance(0);
        return;
      }

      setBalance(parsedBalance.balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      toast.error("Failed to fetch balance");
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  const updateWalletBalance = useCallback((payload: RealtimePostgresUpdatePayload<Record<string, string>>, currentBalance: number) => {
    const stringifiedBalance = currentBalance.toString();
    const shouldUpdateBalance = payload.new.balance !== stringifiedBalance;

    if (shouldUpdateBalance) {
      toast.info("Wallet balance updated");
      setBalance(Number(payload.new.balance));
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    const walletSubscription = supabase
      .channel("wallet")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `circle_wallet_id=eq.${walletId}`,
        },
        payload => updateWalletBalance(payload, balance)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletSubscription);
    };
  }, [supabase, walletId, balance, updateWalletBalance]);

  return {
    balance,
    loading,
    refreshBalance: fetchBalance,
  };
}