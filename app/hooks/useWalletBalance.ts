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
import { useEffect, useId, useRef, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import { WALLET_REFRESH_EVENT } from "@/lib/wallet-refresh";

// Circle credits a moment after the onramp settles, so re-read a few times until the figure moves.
const REFRESH_ATTEMPTS = 6;
const REFRESH_INTERVAL_MS = 2_500;

interface UseWalletBalanceResult {
  balance: number;
  loading: boolean;
  refreshBalance: (quiet?: boolean) => Promise<number | null>;
}

const supabase = createSupabaseBrowserClient()

export function useWalletBalance(walletId: string): UseWalletBalanceResult {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Unique channel name per hook copy: a shared name reuses an already subscribed channel and throws.
  const channelId = useId();

  // Mirrors balance so the retry loop can compare without re-subscribing.
  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // Returns what it read, since state only lands after commit; quiet skips the skeleton and the toast.
  const fetchBalance = useCallback(async (quiet = false): Promise<number | null> => {
    try {
      if (!quiet) setLoading(true);
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
        if (!quiet) {
          toast.error("Error fetching wallet balance", {
            description: parsedBalance.error
          });
        }
        return null;
      }

      if (parsedBalance.balance === null || parsedBalance.balance === undefined) {
        console.log("Wallet has no balance");
        if (!quiet) toast.info("Wallet has no balance");
        setBalance(0);
        return 0;
      }

      // The route returns a string, so coerce it and keep every comparison numeric.
      const value = Number(parsedBalance.balance);
      setBalance(value);
      return value;
    } catch (error) {
      console.error("Error fetching balance:", error);
      if (!quiet) toast.error("Failed to fetch balance");
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [walletId]);

  const updateWalletBalance = useCallback((payload: RealtimePostgresUpdatePayload<Record<string, string>>, currentBalance: number) => {
    // Numeric compare: the column is text, so "20.00" and "20" are the same balance.
    const nextBalance = Number(payload.new.balance);

    if (Number.isNaN(nextBalance) || nextBalance === currentBalance) return;

    toast.info("Wallet balance updated");
    setBalance(nextBalance);
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Fallback for a deposit the webhook never reported; re-reads Circle for a short while.
  useEffect(() => {
    let cancelled = false;

    const onRefresh = async () => {
      const before = balanceRef.current;

      for (let attempt = 0; attempt < REFRESH_ATTEMPTS; attempt += 1) {
        const current = await fetchBalance(true);

        if (cancelled || (current !== null && current !== before)) return;

        await new Promise(resolve => setTimeout(resolve, REFRESH_INTERVAL_MS));

        if (cancelled) return;
      }
    };

    const listener = () => void onRefresh();

    window.addEventListener(WALLET_REFRESH_EVENT, listener);

    return () => {
      cancelled = true;
      window.removeEventListener(WALLET_REFRESH_EVENT, listener);
    };
  }, [fetchBalance]);

  useEffect(() => {
    const walletSubscription = supabase
      .channel(`wallet:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `circle_wallet_id=eq.${walletId}`,
        },
        payload => updateWalletBalance(payload, balanceRef.current)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletSubscription);
    };
  }, [channelId, walletId, updateWalletBalance]);

  return {
    balance,
    loading,
    refreshBalance: fetchBalance,
  };
}