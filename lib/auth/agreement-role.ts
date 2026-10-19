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

export type AgreementRole = "depositor" | "beneficiary";

interface AgreementParties {
  depositor_wallet_id: string;
  beneficiary_wallet_id: string;
}

/**
 * Which side of the agreement a wallet is on, or null if it is neither.
 * The depositor funds and deposits; the beneficiary submits work and can refund.
 * Each money-moving route must require the matching role, because the contract
 * calls run from that party's Circle wallet using the app's own API key.
 */
export function roleInAgreement(
  agreement: AgreementParties,
  walletId: string
): AgreementRole | null {
  if (agreement.depositor_wallet_id === walletId) return "depositor";
  if (agreement.beneficiary_wallet_id === walletId) return "beneficiary";
  return null;
}
