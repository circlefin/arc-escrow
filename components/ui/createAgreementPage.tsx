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

import { useState, useEffect } from "react";
import { createClient } from "@/lib/utils/supabase/client";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UploadContractButton } from "@/components/upload-contract-button";
import { Skeleton } from "./skeleton";

interface Wallet {
  id: string;
  wallet_address: string;
  profile_id: string;
}

interface Profile {
  id: string;
  name: string;
  auth_user_id: string;
  email: string;
  wallets: Wallet[];
}

interface DocumentAnalysis {
  amounts: Array<{
    full_amount: string;
    payment_for: string;
    location: string;
  }>;
  tasks: Array<{
    task_description: string;
    due_date: string | null;
    responsible_party: string;
    additional_details: string;
  }>;
}

interface EscrowAgreement {
  id: string;
  beneficiary_wallet_id: string;
  depositor_wallet_id: string;
  transaction_id: string;
  status: string;
  terms: any;
  created_at: string;
  updated_at: string;
}

export const CreateAgreementPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] =
    useState<Profile | null>(null);
  const [formError, setFormError] = useState(
    "Please select a recipient before uploading a contract"
  );
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("Not authenticated");

        setUserId(user.id);

        // Get current user's profile with wallet
        const { data: currentProfile, error: profileError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            name,
            auth_user_id,
            email,
            wallets (
              id,
              wallet_address,
              profile_id
            )
          `
          )
          .eq("auth_user_id", user.id)
          .single();

        if (profileError) throw profileError;
        setCurrentUserProfile(currentProfile);

        // Get all other profiles with their wallets
        const { data: beneficiaryProfiles, error: beneficiariesError } =
          await supabase
            .from("profiles")
            .select(
              `
            id,
            name,
            auth_user_id,
            email,
            wallets (
              id,
              wallet_address,
              profile_id
            )
          `
            )
            .neq("auth_user_id", user.id);

        if (beneficiariesError) throw beneficiariesError;

        if (!beneficiaryProfiles) {
          throw new Error("No beneficiary profiles found.");
        }

        // Filter out profiles without wallets
        const validBeneficiaries = beneficiaryProfiles.filter(
          (profile) => profile.wallets && profile.wallets.length > 0
        );
        setBeneficiaries(validBeneficiaries);
      } catch (error) {
        console.error("Error loading data:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load profiles"
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleBeneficiarySelect = (beneficiaryName: string) => {
    const beneficiary = beneficiaries.find((b) => b.name === beneficiaryName);
    setSelectedBeneficiary(beneficiary || null);
    setFormError(
      beneficiary
        ? ""
        : "Please select a recipient before uploading a contract"
    );
    setOpen(false);
  };

  const handleAnalysisComplete = (
    analysis: DocumentAnalysis,
    agreement: EscrowAgreement
  ) => {
    console.log("Document analysis completed:", analysis);
    console.log("Agreement created:", agreement);
  };

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        <p>There was an error loading profiles. Please try again later.</p>
      </div>
    );
  }

  if (!loading && !currentUserProfile?.wallets?.[0]) {
    return (
      <div className="text-center text-red-500 p-4">
        <p>No wallet found for current user</p>
      </div>
    );
  }

  return (
    <Card className="grow">
      <CardHeader>
        {loading
          ? <Skeleton className="w-[250px] h-[24px] rounded-full" />
          : <CardTitle>Create new agreement</CardTitle>}
      </CardHeader>
      <CardContent className={formError ? "pb-2" : ""}>
        <div className="grid w-full items-left gap-4">
          <div className="flex flex-col space-y-1.5">
            {loading
              ? <Skeleton className="w-[76px] h-[14px] rounded-full" />
              : <Label>Recipient</Label>}
            {loading
              ? <Skeleton className="w-[434px] h-[40px]" />
              : (
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-[300px] justify-between w-full"
                    >
                      {selectedBeneficiary
                        ? selectedBeneficiary.name
                        : "Select recipient..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  {formError && (
                    <Label className="text-red-500">
                      {formError}
                    </Label>
                  )}
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput
                        className="w-full"
                        placeholder="Search recipient..."
                      />
                      <CommandList>
                        {beneficiaries.length > 0
                          ? (
                            <CommandGroup>
                              {beneficiaries.map(beneficiary => (
                                <CommandItem
                                  key={beneficiary.id}
                                  value={beneficiary.name}
                                  onSelect={handleBeneficiarySelect}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedBeneficiary?.id === beneficiary.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {beneficiary.name && beneficiary.email
                                ? `${beneficiary.name} (${beneficiary.email})`
                                : beneficiary.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )
                          : <CommandEmpty>No beneficiaries found.</CommandEmpty>
                        }
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {loading
          ? <Skeleton className="w-[163px] h-[40px]" />
          : (
              <UploadContractButton
                beneficiaryWalletId={selectedBeneficiary?.wallets[0]?.id}
                depositorWalletId={currentUserProfile?.wallets[0].id}
                userId={userId!}
                userProfileId={currentUserProfile?.id}
                onAnalysisComplete={handleAnalysisComplete}
              />
          )}
      </CardFooter>
    </Card>
  );
};
