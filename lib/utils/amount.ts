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

export const parseAmount = (amountStr: string): number => {
  const cleanAmount = amountStr
    .replace(/[()]/g, "")
    .replace(/[$€£,\s]/g, "")
    .replace(/−/g, "-");

  // Parse the amount
  const amount = parseFloat(cleanAmount);

  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  return amount;
};

export function convertUSDCToContractAmount(amount: number): string {
  // Round to whole base units: USDC has 6 decimals and the value is passed as a
  // uint256, so the result has to be an integer. amount * 1000000 is float math,
  // and ordinary amounts like 2.01 land just under (2009999.9999999998), which
  // .toString() would carry through as a fractional, invalid on-chain amount.
  return Math.round(amount * 1000000).toString();
}
