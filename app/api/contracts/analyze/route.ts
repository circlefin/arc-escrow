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
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { openai } from "@/lib/utils/openAIClient";
import { handleOpenAIError } from "@/lib/utils/openai-error-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { getAuthenticatedUser, unauthorized } from "@/lib/auth/session";
import { FILE_CONSTANTS } from "@/lib/constants";

const FILE_PROCESSORS = {
  "application/pdf": async (buffer: Buffer) => {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    async (buffer: Buffer) => {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    },
} as const;

type FileType = keyof typeof FILE_PROCESSORS;

const ANALYSIS_PROMPT = `
  Analyze the following document and extract:

  - All monetary amounts (including their currency), what they are for, and where they appear
  - All tasks, deliverables, and obligations (including descriptions, due dates, responsible parties, and details)

  Your response should include only a JSON object with two properties, an "amounts" array and a "tasks" arrays, each related to their respective data, nothing else other than that should be included alongside your answer, example below:

  {
    "amounts": [
      {
        "amount": "$1.500",
        "currency": "USD",
        "for": "Full compensation for the services provided under this agreement",
        "location": "Section 2.1"
      }
    ],
    "tasks": [
      "Create and deliver one high-quality, professionally photographed image featuring SparkleFizzCo.’s flagship beverage, SparkleFizz Original Citrus.",
      "Deliver one primary image and two social media adaptations optimized for Instagram.",
      "Submit the final image for Brand's approval."
    ]
  }

  Be sure to strictly follow the data structure exemplified above, and to start all sentences with an uppercase letter.

  Below you will find the content for the document to be analyzed:
`;

export async function POST(req: Request) {
  // Each call spends OpenAI credit and parses an uploaded file: signed-in users only.
  const supabase = await createSupabaseServerClient();
  if (!(await getAuthenticatedUser(supabase))) return unauthorized();

  if (!req.body) {
    return NextResponse.json({ error: "No body provided" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > FILE_CONSTANTS.MAX_SIZE_5MB) {
      return NextResponse.json(
        { error: "Please upload a contract smaller than 5 MB" },
        { status: 413 }
      );
    }

    if (!Object.hasOwn(FILE_PROCESSORS, file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or DOCX file." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const textContent = await FILE_PROCESSORS[file.type as FileType](buffer);

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `${ANALYSIS_PROMPT} ${textContent}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      });
    } catch (openaiError) {
      const { status, body } = handleOpenAIError(openaiError);
      return NextResponse.json(body, { status });
    }

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error analyzing document:", error);
    
    const isAuthError = error instanceof Error && (
      error.message.includes("API key") || 
      error.message.includes("Incorrect API key") ||
      error.message.includes("invalid_api_key") ||
      error.message.includes("authentication") ||
      error.message.includes("401")
    );
    
    if (isAuthError) {
      return NextResponse.json(
        {
          error: "AI service is not properly configured. Please contact support to resolve this issue.",
          code: "auth_error",
          retryable: false,
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze document",
        retryable: false,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Send a POST request with a PDF or DOCX file to analyze",
    supportedTypes: Object.keys(FILE_PROCESSORS),
  });
}
