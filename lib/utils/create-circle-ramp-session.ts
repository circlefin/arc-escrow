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

export const createRampSession = async (
  rampType: "BUY" | "SELL",
  walletAddress: string,
) => {
  if (!process.env.CIRCLE_BLOCKCHAIN) {
    throw new Error("CIRCLE_BLOCKCHAIN environment variable is not set");
  }

  const response = await fetch("https://api.circle.com/v1/w3s/ramp/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
    },
    body: JSON.stringify({
      mode: "QUOTE_SCREEN",
      rampType,
      walletAddress: {
        address: walletAddress,
        blockchain: process.env.CIRCLE_BLOCKCHAIN,
      },
      country: {
        country: "US",
      },
      fiatAmount: {
        currency: "USD",
      },
      cryptoAmount: {
        currency: "USDC",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Circle API error: ${await response.text()}`);
  }

  const parsedResponse = await response.json();

  if (!parsedResponse.data) {
    throw new Error("Invalid response from Circle API");
  }

  return parsedResponse;
};
