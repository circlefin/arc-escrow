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

  // The cleaned string must be a plain decimal in its entirety. parseFloat
  // accepts a valid numeric prefix and ignores the rest, so "10abc" would parse
  // as 10 and "1e5" as 100000 — both silently altering a monetary value.
  if (!/^\d+(\.\d+)?$/.test(cleanAmount)) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  const amount = parseFloat(cleanAmount);

  if (amount <= 0) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  return amount;
};

export function convertUSDCToContractAmount(amount: number): string {
  return (amount * 1000000).toString();
}
