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

import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { FILE_CONSTANTS } from "@/lib/constants";
import { DocumentAnalysis } from "@/types/agreements";

export const createFileService = (supabase: SupabaseClient) => ({
  validateFile(file: File): void {
    if (!file) throw new Error("No file provided");

    if (
      !FILE_CONSTANTS.VALID_TYPES.includes(
        file.type as
          | "application/pdf"
          | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ) {
      throw new Error("Only PDF and DOCX contracts are allowed");
    }

    if (file.size > FILE_CONSTANTS.MAX_SIZE_5MB) {
      throw new Error("Please upload a contract smaller than 5 MB");
    }
  },

  async uploadToTemp(file: File, userId: string): Promise<string> {
    const tempFolderId = uuidv4();
    const safeFileName = encodeURIComponent(file.name);
    const tempPath = `temp/${userId}/${tempFolderId}/${safeFileName}`;

    const { error } = await supabase.storage
      .from(FILE_CONSTANTS.BUCKET_NAME)
      .upload(tempPath, file);

    if (error) throw new Error(`Failed to upload file: ${error.message}`);
    return tempPath;
  },

  async downloadAndUploadToFinal(
    tempPath: string,
    file: File,
    agreementId: string
  ): Promise<string> {
    const { data, error: downloadError } = await supabase.storage
      .from(FILE_CONSTANTS.BUCKET_NAME)
      .download(tempPath);

    if (downloadError || !data) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    const safeFileName = encodeURIComponent(file.name);
    const finalPath = `${agreementId}/${safeFileName}`;
    const newFile = new File([data], file.name, { type: file.type });

    const { error: uploadError } = await supabase.storage
      .from(FILE_CONSTANTS.BUCKET_NAME)
      .upload(finalPath, newFile);

    if (uploadError) {
      throw new Error(
        `Failed to upload to final location: ${uploadError.message}`
      );
    }

    return finalPath;
  },

  async deleteTempFile(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(FILE_CONSTANTS.BUCKET_NAME)
      .remove([path]);
    if (error) {
      throw new Error(`Failed to delete temporary file: ${error.message}`);
    }
  },

  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(FILE_CONSTANTS.BUCKET_NAME)
      .createSignedUrl(path, 7 * 24 * 60 * 60); // 7 days

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to get signed URL: ${error?.message}`);
    }

    return data.signedUrl;
  },

  async analyzeDocument(file: File): Promise<DocumentAnalysis> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/contracts/gatherDocumentInfo", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Failed to process document";
      try {
        const errorResponse = await response.json();
        errorMessage = errorResponse.details || errorMessage;
      } catch {
        // Optional: Log the parsing error if needed
      }
      throw new Error(errorMessage);
    }

    try {
      const data = await response.json();
      return data;
    } catch {
      throw new Error("Failed to parse response data");
    }
  },
});
