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

namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL: string
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    NEXT_PUBLIC_USDC_CONTRACT_ADDRESS: string
    NEXT_PUBLIC_AGENT_WALLET_ID: string
    NEXT_PUBLIC_AGENT_WALLET_ADDRESS: string
    SUPABASE_SERVICE_ROLE_KEY: string
    CIRCLE_API_KEY: string
    CIRCLE_ENTITY_SECRET: string
    CIRCLE_BLOCKCHAIN: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    OPENAI_API_KEY: string
    OPENAI_ASSISTANT_ID: string
  }
}