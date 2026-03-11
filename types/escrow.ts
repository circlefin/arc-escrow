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

import { EscrowAgreement } from "./agreements";

export interface EscrowAgreementWithDetails extends EscrowAgreement {
  // Wallet IDs
  beneficiary_wallet_id: string;
  depositor_wallet_id: string;
  circle_contract_id: string;

  depositor_wallet: {
    profile_id: string;
    wallet_address: string;
    profiles: {
      name: string;
      full_name: string;
      email: string;
      company_name: string;
      auth_user_id: string;
    }
  };
  beneficiary_wallet: {
    profile_id: string;
    wallet_address: string;
    profiles: {
      name: string;
      full_name: string;
      email: string;
      company_name: string;
      auth_user_id: string;
    };
  };
  transaction: {
    amount: number;
    currency: string;
    status: string;
    circle_contract_address: string;
  };
}

export interface EscrowListProps {
  userId: string;
  profileId: string;
  walletId: string
}

export type AgreementStatus = "PENDING" | "OPEN" | "LOCKED" | "CLOSED";
