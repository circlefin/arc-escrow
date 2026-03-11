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

import { type FunctionComponent, type HTMLProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props extends HTMLProps<HTMLElement> {
  mode: "BUY" | "SELL";
  walletAddress: string;
}

export const USDCButton: FunctionComponent<Props> = ({ mode, walletAddress, className }) => {
  const [loading, setLoading] = useState(false);

  const redirectToRamp = async () => {
    setLoading(true);

    const usdcAccessResponse = await fetch(`/api/usdc/${mode.toLowerCase()}`, {
      method: "POST",
      body: JSON.stringify({
        wallet_address: walletAddress
      })
    });

    setLoading(false);

    const parsedUsdcAccessResponse = await usdcAccessResponse.json();
    window.open(parsedUsdcAccessResponse.url, "popup", "width=500,height=600");
  }

  return (
    <Button className={className} disabled={loading} onClick={redirectToRamp}>
      {loading
        ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        )
        : mode === "BUY" ? "Deposit" : "Withdraw"}
    </Button>
  )
}