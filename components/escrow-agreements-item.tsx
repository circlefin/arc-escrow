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

import { useRef, useState } from "react";
import { FileText, ExternalLink, CircleDollarSign, Loader2, ImageUp, Trash2, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AgreementStatus, EscrowAgreementWithDetails } from "@/types/escrow";
import { getStatusColor } from "@/lib/utils/escrow";
import { CreateSmartContractButton } from "@/components/deploy-smart-contract-button";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import Confetti from "react-confetti";
import { AgreementDeleteDialog } from "./agreement-delete-dialog";
import { ValidationFailedDialog } from "./validation-failed-dialog";
import { ValidationSucceededDialog } from "./validation-succeeded-dialog";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";

interface EscrowAgreementCardProps {
  agreement: EscrowAgreementWithDetails;
  profileId: string;
  userId: string;
  depositing?: string;
  refresh: () => Promise<void>;
  preApproveCallback: () => void;
}

interface Task {
  description: string;
  due_date: string;
  responsible_party: string;
  details: string[];
}

interface Amount {
  for: string;
  amount: string;
  location: string;
}

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? process.env.NEXT_PUBLIC_VERCEL_URL
  : "http://localhost:3000";

const supabase = createSupabaseBrowserClient();

export const EscrowAgreementItem: React.FC<EscrowAgreementCardProps> = ({
  agreement,
  profileId,
  userId,
  depositing,
  refresh,
  preApproveCallback
}) => {
  const [submittingWork, setSubmittingWork] = useState<string>();
  const [issuingRefund, setIssuingRefund] = useState<string>();
  const [validationResult, setValidationResult] = useState([]);
  const [workAccepted, setWorkAccepted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmitWork = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleIssueRefund = async (circleContractId: string) => {
    setIssuingRefund(circleContractId);

    try {
      const response = await fetch(`${baseUrl}/api/contracts/escrow/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          circleContractId
        })
      });

      const parsedResponse = await response.json();

      if (parsedResponse.error) {
        toast.error("Could not issue refund", {
          description: parsedResponse.error
        });
        return;
      }

      toast.success("Refund issued successfully");

      refresh();
    } catch (error) {
      console.error("Error issuing refund:", error);
      toast.error("An error occurred while issuing refund");
    } finally {
      setIssuingRefund(undefined);
    }
  }

  const submitWork = async (
    event: React.ChangeEvent<HTMLInputElement>,
    circleContractId: string
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setSubmittingWork(circleContractId);
      try {
        const formData = new FormData();
        formData.append("circleContractId", circleContractId)
        formData.append("file", file);

        const response = await fetch(`${baseUrl}/api/contracts/validate-work`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const parsedResponse = await response.json();

        if (parsedResponse.error) {
          if (parsedResponse.reasons) {
            setValidationResult(parsedResponse.reasons);
          } else {
            const message = parsedResponse.retryable
              ? `${parsedResponse.error} Please try again.`
              : parsedResponse.error;
            toast.error("Work submission failed", { description: message });
          }
          return;
        }
        if (response.ok && !parsedResponse.error) {
          setWorkAccepted(true);
        } else {
          toast.error("Unexpected error occurred during work submission");
        }

        toast.success(parsedResponse.message || "Work submitted successfully");
      } catch (error) {
        console.error("Error submitting work:", error);
        toast.error("An error occurred while submitting the work");
      } finally {
        setSubmittingWork(undefined);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  const approveDeposit = async (agreement: EscrowAgreementWithDetails) => {
    preApproveCallback();

    const approveResponse = await fetch(`${baseUrl}/api/contracts/escrow/deposit/approve`, {
      method: "POST",
      body: JSON.stringify({
        circleContractId: agreement.circle_contract_id,
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const parsedApproveResponse = await approveResponse.json();

    if (parsedApproveResponse.error) {
      console.error("Failed to approve funds deposit:", parsedApproveResponse.error);
      toast.error("Failed to approve funds deposit", {
        description: parsedApproveResponse.error
      })
    }

    refresh();

    toast.info(parsedApproveResponse.message);
  }

  const handleDeleteEscrow = async (id: string) => {
    const { error } = await supabase
      .from("escrow_agreements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete escrow agreement:", error);
      toast.error("An error occurred while deleting the escrow agreement");
    }

    refresh();
  };

  const handleCongratulate = () => {
    setWorkAccepted(false);
    refresh();
  }

  return (
    <>
      <div key={agreement.id}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-medium">
              Agreement with{" "}
              {profileId === agreement.depositor_wallet?.profile_id
                ? agreement.beneficiary_wallet?.profiles.name
                : agreement.depositor_wallet?.profiles.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              Created {new Date(agreement.created_at).toLocaleString()}
            </p>
          </div>

          {agreement.status !== "INITIATED" && (
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded text-sm font-medium ${getStatusColor(
                  agreement.status as AgreementStatus
                )}`}
              >
                {agreement.status}
              </span>
            </div>
          )}
        </div>
        <div>
          {(userId === agreement.depositor_wallet?.profiles?.auth_user_id && agreement.status === "INITIATED") && (
            <div className="flex justify-between place-items-center">
              <CreateSmartContractButton agreement={agreement} />
              <AgreementDeleteDialog
                agreement={agreement}
                profileId={profileId}
                handleDeleteEscrow={handleDeleteEscrow}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AgreementDeleteDialog>
            </div>
          )}
          {(userId === agreement.depositor_wallet?.profiles?.auth_user_id && agreement.status === "OPEN") && (
            <Button disabled={depositing === agreement.id} onClick={() => approveDeposit(agreement)}>
              {depositing === agreement.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <CircleDollarSign className="mr-2 h-4 w-4" />
                  Deposit funds
                </>
              )}
            </Button>
          )}
          {(userId === agreement.beneficiary_wallet?.profiles?.auth_user_id && agreement.status === "LOCKED") && (
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={event => submitWork(event, agreement.circle_contract_id)}
              />
              <Button disabled={submittingWork !== undefined} onClick={handleSubmitWork}>
                {submittingWork === agreement.circle_contract_id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ImageUp className="mr-2 h-4 w-4" />
                    Submit work
                  </>
                )}
              </Button>
              <Button
                disabled={issuingRefund !== undefined}
                onClick={() => handleIssueRefund(agreement.circle_contract_id)}
              >
                {issuingRefund === agreement.circle_contract_id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Issuing refund...
                  </>
                ) : (
                  <>
                    <HandCoins className="mr-2 h-4 w-4" />
                    Issue refund
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        <Separator className="my-4" />
        {agreement.transactions.circle_contract_address && (
          <>
            <p className="text-sm font-medium leading-none mb-2">
              Contract address:
            </p>
            <div className="flex w-full items-center space-x-2 mb-3">
              <Input disabled value={agreement.transactions.circle_contract_address} />
              <CopyButton text={agreement.transactions.circle_contract_address} />
            </div>
          </>
        )}
        {agreement.terms.documentUrl && (
          <a
            href={agreement.terms.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/90"
          >
            <FileText className="h-4 w-4" />
            {agreement.terms.originalFileName}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {agreement.terms.amounts &&
          agreement.terms.amounts.length > 0 && (
            <>
              <p className="text-sm font-medium text-muted-foreground mt-3">
                Amounts ({agreement.terms.amounts?.length})
              </p>
              <ul className="mt-1 space-y-1">
                {agreement.terms.amounts?.map(
                  (amount: Amount, index: number) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground"
                    >
                      • {amount.for} - {amount.amount}
                      <span className="text-xs ml-1">
                        ({amount.location})
                      </span>
                    </li>
                  )
                )}
              </ul>
            </>
          )}
        {agreement.terms.tasks && agreement.terms.tasks.length > 0 && (
          <>
            <p className="text-sm font-medium text-muted-foreground mt-3">
              Tasks ({agreement.terms.tasks?.length})
            </p>
            <ul className="mt-1 space-y-1">
              {agreement.terms.tasks?.map(
                (task: Task, index: number) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground"
                  >
                    • {task.description}
                    {task.due_date && (
                      <span className="ml-1 text-xs">
                        (Due: {task.due_date})
                      </span>
                    )}
                  </li>
                )
              )}
            </ul>
          </>
        )}
      </div>
      <ValidationFailedDialog
        validationResult={validationResult}
        handleClose={() => setValidationResult([])}
      />
      <ValidationSucceededDialog
        workAccepted={workAccepted}
        handleCongratulate={handleCongratulate}
      />
    </>
  );
};
