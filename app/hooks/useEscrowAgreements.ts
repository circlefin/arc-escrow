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

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";

import { createEscrowService } from "@/app/services/escrow.service";
import { EscrowAgreementWithDetails, EscrowListProps } from "@/types/escrow";
import { createClient } from "@/lib/utils/supabase/client";

export const useEscrowAgreements = ({ profileId }: EscrowListProps) => {
  const [agreements, setAgreements] = useState<EscrowAgreementWithDetails[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const escrowService = useMemo(
    () => createEscrowService(supabase),
    [supabase]
  );

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const fetchAgreements = useCallback(async (showLoading: boolean) => {
    let retries = 0;
    try {
      if (showLoading) setLoading(true);
      while (retries < MAX_RETRIES) {
        try {
          const data = await escrowService.getAgreements(profileId);
          setAgreements(data);
          setError(null);
          break;
        } catch (err) {
          if (retries === MAX_RETRIES - 1) throw err;
          retries++;
          await sleep(RETRY_DELAY * retries);
        }
      }
    } catch (err) {
      console.error("Error loading agreements:", err);
      if (err instanceof TypeError) {
        setError("Network error. Please check your connection.");
      } else if (err instanceof Response) {
        setError(`Server error: ${err.statusText}`);
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to load agreements"
        );
      }
      toast.error("Error loading agreements");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [escrowService, profileId]);

  const refresh = useCallback(() => fetchAgreements(false), [fetchAgreements]);

  useEffect(() => {
    fetchAgreements(true);
  }, [profileId, fetchAgreements]);

  return {
    agreements,
    loading,
    error,
    refresh,
  };
};
