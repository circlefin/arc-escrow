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

import { useState } from "react";
import { toast } from "sonner";

import { createFileService } from "@/app/services/file.service";
import { createAgreementService } from "@/app/services/agreement.service";
import { CreateAgreementProps } from "@/types/agreements";
import { createClient } from "@/lib/utils/supabase/client";
import { parseAmount } from "@/lib/utils/amount";

interface Amount {
  amount: string;
  full_amount: string;
  payment_for: string;
  for: string;
  location: string;
}

interface Task {
  task_description: string;
  description: string;
  details: string[];
  due_date: string;
  responsible_party: string;
  additional_details: string;
}

export interface DocumentAnalysis {
  amounts: Amount[];
  tasks: Task[];
}

export const useContractUpload = (props: CreateAgreementProps) => {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = createClient();
  const fileService = createFileService(supabase);
  const agreementService = createAgreementService(supabase);

  const analyzeDocument = async (
    file: File
  ): Promise<DocumentAnalysis | { error: string }> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/contracts/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));

        // Handle different error scenarios with user-friendly messages
        let message = body.error || "Failed to analyze document";

        // For retryable errors, add retry prompt
        if (body.retryable) {
          message = `${message} Please try again.`;
        }

        // Ensure authentication/configuration errors are user-friendly
        if (body.code === "auth_error" || message.includes("AI service")) {
          message =
            "AI service is not properly configured. Please contact support to resolve this issue.";
        }

        return { error: message };
      }

      return response.json();
    } catch (err) {
      console.error("Error analyzing document:", err);
      return {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while analyzing the document",
      };
    }
  };

  const handleFileUpload = async (file: File) => {
    setDone(false);

    if (!props.beneficiaryWalletId) {
      toast.error("Missing beneficiary", {
        description: "Please select a recipient before uploading a contract",
      });
      return;
    }

    let tempPath: string | null = null;
    setUploading(true);

    try {
      fileService.validateFile(file);

      // Upload to temp location
      tempPath = await fileService.uploadToTemp(file, props.userId);

      // Analyze document using the new API
      const analysisResult = await analyzeDocument(file);

      // Check if analysis returned an error
      if ("error" in analysisResult) {
        throw new Error(analysisResult.error);
      }

      const analysis = analysisResult;

      if (!analysis.amounts?.length) {
        throw new Error("No amounts found in the document");
      }

      // Create transaction with the new amount format
      const amount = parseAmount(analysis.amounts[0].amount);
      const transaction = await agreementService.createTransaction({
        walletId: props.depositorWalletId!,
        profileId: props.userProfileId!,
        amount,
        description:
          analysis.amounts[0]?.payment_for || "Escrow agreement deposit",
      });

      // Create agreement
      const agreement = await agreementService.createAgreement({
        beneficiaryWalletId: props.beneficiaryWalletId,
        depositorWalletId: props.depositorWalletId!,
        transactionId: transaction.id,
        terms: {
          ...analysis,
          originalFileName: file.name,
        },
      });

      // Move file to final location
      const finalPath = await fileService.downloadAndUploadToFinal(
        tempPath,
        file,
        agreement.id
      );

      // Cleanup temp file
      await fileService.deleteTempFile(tempPath);

      // Get public URL and update agreement
      const signedUrl = await fileService.getSignedUrl(finalPath);
      await agreementService.updateAgreementTerms(agreement.id, {
        ...analysis,
        documentUrl: signedUrl,
        originalFileName: file.name,
      });

      toast.success("Document processed successfully", {
        description: `Found ${analysis.amounts.length} amounts and ${
          analysis.tasks?.length || 0
        } tasks`,
      });

      props.onAnalysisComplete?.(analysis, {
        ...agreement,
        terms: {
          ...analysis,
          documentUrl: signedUrl,
          originalFileName: file.name,
        },
      });

      return { analysis, agreement };
    } catch (error) {
      console.error("Process error:", error);

      if (tempPath) {
        try {
          await fileService.deleteTempFile(tempPath);
        } catch (deleteError) {
          console.error("Failed to delete temporary file:", deleteError);
        }
      }

      toast.error("Process failed", {
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while processing the document. Please try again later.",
      });
    } finally {
      setUploading(false);
      setDone(true);
    }
  };

  return { handleFileUpload, analyzeDocument, uploading, done };
};
