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

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { type FunctionComponent, useState } from "react";
import { toast } from "sonner";

interface Props {
  walletAddress: string;
}

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

export const RequestUsdcButton: FunctionComponent<Props> = ({ walletAddress }) => {
  const [requesting, setRequesting] = useState(false);

  const requestFaucetUsdc = async () => {
    try {
      setRequesting(true);

      const response = await fetch(`${baseUrl}/api/wallet/balance/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress })
      });

      setRequesting(false);

      const parsedResponse = await response.json();

      if (parsedResponse.error) {
        console.error(parsedResponse.error);
        toast.error(parsedResponse.error);
      }

      toast.success(parsedResponse.message);
    } catch (error) {
      console.error("Failed to request USDC via faucet", error);
      toast.error("Failed to request USDC via faucet");
    }
  }

  return (
    <Button disabled={requesting} onClick={requestFaucetUsdc}>
      {requesting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : "Request 20 USDC via Faucet"}
    </Button>
  )
}