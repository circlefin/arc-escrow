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

import type { EscrowAgreementWithDetails } from '@/types/escrow';
import { useState, useCallback } from 'react';

interface CreateSmartContractRequest {
  agreement: EscrowAgreementWithDetails;
  agentAddress: string;
  agentWalletId: string;
  amountUSDC: number;
}

export interface SmartContractResponse {
  success: boolean;
  id?: string;
  transactionId?: string;
  status: string;
  message?: string;
  addresses?: {
    depositor: string;
    beneficiary: string;
    agent: string;
  };
  error?: string;
  details?: string;
}

interface TransactionStatusResponse {
  success: boolean;
  status?: string;
  transaction?: {
    state: string;
    [key: string]: any;
  };
  error?: string;
  details?: string;
}

interface UseSmartContractReturn {
  createSmartContract: (data: CreateSmartContractRequest) => Promise<SmartContractResponse>;
  checkStatus: (transactionId: string) => Promise<TransactionStatusResponse>;
  isLoading: boolean;
  error: string | null;
}

export function useSmartContract(): UseSmartContractReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSmartContract = useCallback(async (data: CreateSmartContractRequest): Promise<SmartContractResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/contracts/escrow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create Smart contract');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while creating the Smart contract';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkStatus = useCallback(async (transactionId: string): Promise<TransactionStatusResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/contracts/escrow?id=${transactionId}`, {
        method: 'GET',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check transaction status');
      }

      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while checking the transaction status';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createSmartContract,
    checkStatus,
    isLoading,
    error,
  };
}