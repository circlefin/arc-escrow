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

import {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  RateLimitError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
} from "openai";
import {
  LengthFinishReasonError,
  ContentFilterFinishReasonError,
} from "openai/core/error";

interface OpenAIErrorResponse {
  status: number;
  body: {
    error: string;
    code?: string;
    retryable: boolean;
  };
}

export function handleOpenAIError(error: unknown): OpenAIErrorResponse {
  if (error instanceof RateLimitError) {
    const isQuotaExhausted = error.code === "insufficient_quota";

    console.error("OpenAI RateLimitError:", {
      code: error.code,
      status: error.status,
      requestID: error.requestID,
      isQuotaExhausted,
    });

    if (isQuotaExhausted) {
      return {
        status: 503,
        body: {
          error: "AI service temporarily unavailable. Please try again later.",
          code: "quota_exhausted",
          retryable: false,
        },
      };
    }

    return {
      status: 429,
      body: {
        error: "Too many requests. Please wait a moment and try again.",
        code: "rate_limited",
        retryable: true,
      },
    };
  }

  if (error instanceof AuthenticationError) {
    console.error("OpenAI AuthenticationError:", {
      status: error.status,
      requestID: error.requestID,
    });

    return {
      status: 503,
      body: {
        error: "AI service configuration error. Please contact support.",
        code: "auth_error",
        retryable: false,
      },
    };
  }

  if (error instanceof BadRequestError) {
    console.error("OpenAI BadRequestError:", {
      status: error.status,
      code: error.code,
      requestID: error.requestID,
    });

    return {
      status: 400,
      body: {
        error: "Invalid request to AI service.",
        code: "bad_request",
        retryable: false,
      },
    };
  }

  if (error instanceof APIConnectionTimeoutError) {
    console.error("OpenAI APIConnectionTimeoutError:", {
      message: error.message,
    });

    return {
      status: 503,
      body: {
        error: "Unable to reach AI service. Please try again.",
        code: "timeout",
        retryable: true,
      },
    };
  }

  if (error instanceof APIConnectionError) {
    console.error("OpenAI APIConnectionError:", {
      message: error.message,
    });

    return {
      status: 503,
      body: {
        error: "Unable to reach AI service. Please try again.",
        code: "connection_error",
        retryable: true,
      },
    };
  }

  if (error instanceof InternalServerError) {
    console.error("OpenAI InternalServerError:", {
      status: error.status,
      requestID: error.requestID,
    });

    return {
      status: 502,
      body: {
        error: "AI service encountered an error. Please try again.",
        code: "upstream_error",
        retryable: true,
      },
    };
  }

  if (error instanceof ContentFilterFinishReasonError) {
    console.error("OpenAI ContentFilterFinishReasonError");

    return {
      status: 400,
      body: {
        error: "Content was flagged by AI safety filters.",
        code: "content_filtered",
        retryable: false,
      },
    };
  }

  if (error instanceof LengthFinishReasonError) {
    console.error("OpenAI LengthFinishReasonError");

    return {
      status: 400,
      body: {
        error: "Document too long for AI processing.",
        code: "too_long",
        retryable: false,
      },
    };
  }

  if (error instanceof APIError) {
    console.error("OpenAI APIError:", {
      status: error.status,
      code: error.code,
      requestID: error.requestID,
    });

    return {
      status: 500,
      body: {
        error: "An unexpected error occurred.",
        code: "api_error",
        retryable: false,
      },
    };
  }

  console.error("Unknown OpenAI error:", error);

  return {
    status: 500,
    body: {
      error: "An unexpected error occurred.",
      retryable: false,
    },
  };
}
