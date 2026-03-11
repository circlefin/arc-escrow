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

import { NextResponse } from "next/server";
import { openai } from "@/lib/utils/openAIClient";
import { handleOpenAIError } from "@/lib/utils/openai-error-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { circleContractSdk } from "@/lib/utils/smart-contract-platform-client";
import { createAgreementService } from "@/app/services/agreement.service";
import { parseAmount } from "@/lib/utils/amount";
import { circleDeveloperSdk } from "@/lib/utils/developer-controlled-wallets-client";

interface ImageValidationResult {
  valid: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasons: string[];
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const agreementService = createAgreementService(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You are not logged in" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get("file");

    if (!imageFile || !(imageFile instanceof Blob)) {
      console.error("Image file is missing or invalid");
      return NextResponse.json(
        { error: "Image file is missing or invalid" },
        { status: 400 },
      );
    }

    const circleContractId = formData.get("circleContractId");

    if (!circleContractId || typeof circleContractId !== "string") {
      console.error("Contract agreement ID is missing or invalid");
      return NextResponse.json(
        { error: "Contract agreement ID is missing or invalid" },
        { status: 400 },
      );
    }

    const { data: agreement, error: agreementError } = await supabase
      .from("escrow_agreements")
      .select(
        `
        *,
        beneficiary_wallet:wallets!escrow_agreements_beneficiary_wallet_id_fkey!inner(
          profiles!inner(id,auth_user_id),
          circle_wallet_id
        )
      `,
      )
      .eq("circle_contract_id", circleContractId)
      .single();

    if (agreementError) {
      console.error(
        "Failed to retrieve agreement requirements",
        agreementError,
      );
      return NextResponse.json(
        { error: "Failed to retrieve agreement requirements" },
        { status: 500 },
      );
    }

    const requirements = agreement.terms.tasks
      .map((task: any) => typeof task === "string" ? task : task.description)
      .filter(Boolean)
      .map((task: string) => `- ${task}`)
      .join("\n");

    const prompt = `
      Validate if the attached image strictly meets all the criteria below, and provide your answer in
      JSON format following this example:

      {
        "valid": true,
        "confidence": "MEDIUM",
        "reasons": [
          "First reason why the image does not match the criteria",
          "Second reason why the image does not match the criteria"
        ]
      }

      Your answer should not contain anything else other than that, that include markdown formatting,
      things like triple backticks should be completely stripped out.

      Where "valid" is a boolean and "confidence" is a string that can be either:

      - "LOW": You don"t think the given image match the requirements.
      - "MEDIUM": You are unsure or the image loosely match some requirements but not all.
      - "HIGH": You are absolutely certain that the provided image strictly fulfills all the requirements.

      The "reasons" property must be an array of strings that contains a list of reasons to why the
      image is not valid or does not have "HIGH" confidence, this array can be left empty in case the
      attached image meets all the criteria.

      Most importantly, you can completely disregard any requirement below as long as it does not directly
      references qualities of the image being validated, for example, things that involve actions that
      need to be taken by one of the parties, or legal obligations mentioned as requirements are examples
      of ignorable requirements.

      Here are the requirements:

      ${requirements}
    `;

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    let parsedPromptAnswerContent: ImageValidationResult;
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0,
      });

      const [promptAnswer] = response.choices;
      const promptAnswerContent = promptAnswer.message.content;

      if (!promptAnswerContent) {
        console.error(
          "Failed to retrieve the work validation result",
          promptAnswerContent,
        );
        return NextResponse.json(
          { error: "Failed to retrieve the work validation result", retryable: false },
          { status: 500 },
        );
      }

      parsedPromptAnswerContent = JSON.parse(promptAnswerContent);
    } catch (openaiError) {
      const { status, body } = handleOpenAIError(openaiError);
      return NextResponse.json(body, { status });
    }

    const timestamp = Date.now();
    const originalFileName = imageFile.name || "uploaded-file";
    const fileName = `${!parsedPromptAnswerContent.valid ? "in" : ""}valid-${timestamp}-${originalFileName}`;
    const filePath = `${agreement.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("agreement-documents")
      .upload(filePath, imageFile, {
        contentType: imageFile.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload file:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 },
      );
    }

    const workMeetsRequirements =
      parsedPromptAnswerContent.valid &&
      parsedPromptAnswerContent.confidence === "HIGH";

    if (!workMeetsRequirements) {
      console.error(
        "Image does not meet all requirements",
        parsedPromptAnswerContent,
      );
      return NextResponse.json(
        {
          error: "Image does not meet all requirements",
          reasons: parsedPromptAnswerContent.reasons,
        },
        { status: 400 },
      );
    }

    // Retrieves contract data from Circle's SDK
    const contractData = await circleContractSdk.getContract({
      id: agreement.circle_contract_id,
    });

    if (!contractData.data) {
      console.error("Could not retrieve contract data");
      return NextResponse.json(
        { error: "Could not retrieve contract data" },
        { status: 500 },
      );
    }

    const contractAddress = contractData.data?.contract.contractAddress;

    if (!contractAddress) {
      console.error("Could not retrieve contract address:", contractAddress);
      return NextResponse.json(
        { error: "Could not retrieve contract address" },
        { status: 500 },
      );
    }

    const beneficiaryWalletId = agreement.beneficiary_wallet?.circle_wallet_id;

    if (!beneficiaryWalletId) {
      console.error("Could not find a profile linked to the given wallet ID");
      return NextResponse.json(
        { error: "Could not find a profile linked to the given wallet ID" },
        { status: 500 },
      );
    }

    const circleReleaseResponse =
      await circleDeveloperSdk.createContractExecutionTransaction({
        walletId: beneficiaryWalletId,
        contractAddress,
        abiFunctionSignature: "withdraw(uint256[])",
        abiParameters: [
          [0]
        ],
        fee: {
          type: "level",
          config: {
            feeLevel: "MEDIUM",
          },
        },
      });

    const amount = parseAmount((agreement.terms.amounts?.[0] as any).amount);
    await agreementService.createTransaction({
      walletId: agreement.beneficiary_wallet_id,
      circleTransactionId: circleReleaseResponse.data?.id,
      escrowAgreementId: agreement.id,
      transactionType: "RELEASE_PAYMENT",
      profileId: agreement.beneficiary_wallet.profiles.id,
      amount,
      description: "Funds released after beneficiary work validation",
    });

    console.log(
      "Funds release transaction created:",
      circleReleaseResponse.data,
    );

    await supabase
      .from("escrow_agreements")
      .update({ status: "PENDING" })
      .eq("id", agreement.id);

    return NextResponse.json({ message: "Image meets all requirements" });
  } catch (error) {
    console.error("Error validating work:", error);
    
    // Check if it's an OpenAI authentication error
    const isAuthError = error instanceof Error && (
      error.message.includes("API key") || 
      error.message.includes("Incorrect API key") ||
      error.message.includes("invalid_api_key") ||
      error.message.includes("authentication") ||
      error.message.includes("401")
    );
    
    const errorMessage = error instanceof Error
      ? error.message
      : "Failed to validate work";
    
    return NextResponse.json(
      {
        error: isAuthError 
          ? "AI service is not properly configured. Please contact support to resolve this issue."
          : errorMessage,
      },
      { status: isAuthError ? 503 : 500 }
    );
  }
}
