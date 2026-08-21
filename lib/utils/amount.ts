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

  // Require the entire normalized value to be a decimal amount. parseFloat()
  // alone accepts numeric prefixes such as "10abc" and silently ignores the
  // malformed suffix.
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleanAmount)) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  const amount = Number(cleanAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  return amount;
};

export function convertUSDCToContractAmount(amount: number): string {
  return (amount * 1000000).toString();
}
