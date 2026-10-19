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

import { type FunctionComponent, type HTMLProps, useCallback, useEffect, useRef, useState } from "react";
import {
  ONRAMP_EVENT_TYPES,
  createOnrampKit,
  parseOnrampSession,
  type OnrampEventEnvelope,
} from "@crcl-main/onramp-kit";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { WIDGET_BASE_URL } from "@/lib/onramp-environment";
import { requestWalletRefresh } from "@/lib/wallet-refresh";

type OnrampSession = ReturnType<typeof parseOnrampSession>;

const SESSION_URL = "/api/onramp/session";

// Mints a session; the destination is resolved server-side from the user's wallet.
async function createSession(): Promise<OnrampSession> {
  const response = await fetch(SESSION_URL, { method: "POST" });
  const parsedResponse = await response.json();

  if (!response.ok) {
    throw new Error(parsedResponse.error ?? "Could not create an onramp session");
  }

  return parseOnrampSession(parsedResponse);
}

// Popup mode: openWindow must run synchronously in the click handler, and a session is single-use, so one is always minted ahead.
export const AddMoneyButton: FunctionComponent<HTMLProps<HTMLElement>> = ({ className }) => {
  const [session, setSession] = useState<OnrampSession | null>(null);

  // Lazy so nothing touches window during SSR, and synchronous because openWindow needs it.
  const kitRef = useRef<ReturnType<typeof createOnrampKit> | null>(null);
  const getKit = () => (kitRef.current ??= createOnrampKit({ widgetBaseUrl: WIDGET_BASE_URL }));

  // Held so the popup is torn down if the dashboard unmounts with it open.
  const widgetRef = useRef<{ close: () => void } | null>(null);

  const mintSession = useCallback(async () => {
    setSession(null);
    try {
      setSession(await createSession());
    } catch (error) {
      console.error("Failed to create an onramp session", error);
      toast.error("Could not prepare the deposit", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, []);

  useEffect(() => {
    void mintSession();
    return () => widgetRef.current?.close();
  }, [mintSession]);

  // Fallback for runs the Circle webhook cannot reach: ask the wallet to re-read itself.
  const handleEvent = useCallback((envelope: OnrampEventEnvelope) => {
    if (envelope.event === ONRAMP_EVENT_TYPES.DEPOSIT_SUBMITTED) {
      // Deposits flagged settlementExpected: false never emit a settle event.
      if (envelope.payload.settlementExpected === false) {
        toast.success("Deposit complete");
        requestWalletRefresh();
        return;
      }

      toast.info("Deposit submitted", { description: "It will land once it settles." });
      return;
    }

    if (envelope.event !== ONRAMP_EVENT_TYPES.DEPOSIT_SETTLED) return;

    toast.success("Deposit settled");
    requestWalletRefresh();
  }, []);

  // Must stay synchronous up to openWindow or the browser blocks the popup.
  const addMoney = () => {
    if (!session) return;

    const result = getKit().openWindow({
      session,
      // The session idled out or was rejected; either way, mint a new one.
      onSessionExpired: () => {
        void mintSession();
      },
    });

    if (result.status === "blocked") {
      toast.error(
        result.reason === "popup_blocked"
          ? "Your browser blocked the popup. Allow popups for this site and try again."
          : `Deposit window unavailable (${result.reason})`,
        { description: result.errorMessage },
      );
    } else {
      widgetRef.current = result.widget;
      result.widget.on("*", handleEvent);
    }

    // Spent either way, so line up the next one.
    void mintSession();
  };

  return (
    <Button className={className} disabled={!session} onClick={addMoney}>
      {session ? (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Add money
        </>
      ) : (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Preparing...
        </>
      )}
    </Button>
  );
};
