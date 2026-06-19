# arc-escrow Architecture

## Table of Contents
- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Technology Stack](#technology-stack)
- [Data Flow](#data-flow)
- [Circle Wallets Integration](#circle-wallets-integration)
- [Smart Contract Integration](#smart-contract-integration)
- [OpenAI Validation](#openai-validation)
- [Webhook System](#webhook-system)
- [Database Schema](#database-schema)
- [Security Model](#security-model)

---

## System Overview

The arc-escrow application is an AI-powered escrow platform built on Circle's Arc blockchain testnet. It automates freelance agreement workflows by:

1. **Escrow Creation**: Depositors (clients) create agreements with beneficiaries (freelancers)
2. **Fund Deposit**: USDC funds are deposited into escrow via Circle Developer Controlled Wallets
3. **Work Submission**: Beneficiaries submit deliverables (documents, images, code)
4. **AI Validation**: OpenAI validates submissions against agreement criteria
5. **Fund Release**: Upon validation, funds are released to beneficiary or refunded to depositor

### Key Features
- **USDC-native**: All transactions in USDC on Arc testnet
- **AI-powered**: OpenAI vision models validate work deliverables
- **Developer-controlled wallets**: Circle manages wallet infrastructure
- **Smart contracts**: EIP-712 Refund Protocol for trustless escrow
- **Real-time updates**: Supabase Realtime for instant UI updates

---

## Component Architecture
┌─────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                      │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Agreement   │  │  Submission  │  │  Wallet         │  │
│  │  Dashboard   │  │  Upload      │  │  Management     │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
│
│ API Routes
▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  /api/       │  │  /api/       │  │  /api/webhooks/ │  │
│  │  agreements  │  │  submissions │  │  circle         │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
│                    │                    │
▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Supabase   │    │   OpenAI     │    │   Circle     │
│   Database   │    │   API        │    │   Wallets    │
│              │    │              │    │   API        │
│  - Users     │    │  - Vision    │    │  - Create    │
│  - Agreements│    │  - Validate  │    │  - Transfer  │
│  - Submissions│   │              │    │  - Webhooks  │
└──────────────┘    └──────────────┘    └──────────────┘
│
▼
┌──────────────────────┐
│  Arc Testnet         │
│  (Circle Blockchain) │
│                      │
│  - USDC Token        │
│  - Smart Contracts   │
└──────────────────────┘

### Components

1. **Frontend (Next.js + React)**
   - Server-side rendering for SEO and performance
   - Client components for interactivity
   - Supabase client for auth and real-time data
   - shadcn/ui components for UI

2. **API Routes (Next.js)**
   - RESTful endpoints for CRUD operations
   - Webhook handlers for Circle events
   - Authentication middleware
   - Error handling and validation

3. **Supabase Backend**
   - PostgreSQL database
   - Real-time subscriptions
   - Row-level security (RLS)
   - Authentication and user management

4. **Circle Wallets**
   - Developer Controlled Wallets SDK
   - Smart Contract Platform SDK
   - Webhook signature verification
   - USDC transfers on Arc testnet

5. **OpenAI Integration**
   - GPT-4 Vision for document analysis
   - Multi-modal validation (text, images, PDFs)
   - Structured output for validation results

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: React hooks + Supabase Realtime

### Backend
- **Runtime**: Node.js v22+
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Supabase client (auto-generated types)
- **Authentication**: Supabase Auth

### Blockchain
- **Network**: Arc Testnet
- **Token**: USDC (ERC-20)
- **Wallets**: Circle Developer Controlled Wallets
- **Contracts**: EIP-712 Refund Protocol

### External Services
- **Circle Wallets API**: v4.6.0
- **OpenAI API**: GPT-4 Vision
- **Supabase**: Database + Auth + Realtime
- **ngrok**: Local webhook testing

---

## Data Flow

### 1. Agreement Creation Flow
User (Depositor)
│
├─ Fill agreement form
│   - Beneficiary address
│   - Amount (USDC)
│   - Criteria
│
▼
Next.js API Route
│
├─ Validate input
├─ Create Supabase record
│
▼
Circle Wallets API
│
├─ Create wallet for beneficiary (if needed)
├─ Initiate USDC transfer to escrow
│
▼
Arc Testnet
│
├─ Execute USDC transfer
├─ Emit blockchain event
│
▼
Circle Webhook
│
├─ Receive transfer confirmation
├─ Update Supabase status → "funded"
│
▼
Supabase Realtime
│
└─ Push update to frontend → UI reflects "Active"

### 2. Submission & Validation Flow
User (Beneficiary)
│
├─ Upload deliverable (PDF, image, document)
│
▼
Next.js API Route
│
├─ Store file in Supabase Storage
├─ Create submission record
│
▼
OpenAI API
│
├─ Analyze deliverable using GPT-4 Vision
├─ Compare against agreement criteria
├─ Return validation result
│
▼
Next.js API Route
│
├─ Update submission with AI result
│
▼
If APPROVED:
│
├─ Call Circle Wallets API
├─ Transfer USDC to beneficiary
│
▼
If REJECTED:
│
└─ Notify depositor for manual review

---

## Circle Wallets Integration

### Wallet Creation

The application uses **Developer Controlled Wallets** where Circle manages private keys:

```typescript
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET
})

// Create wallet for user
const wallet = await client.createWallets({
  accountType: 'SCA', // Smart Contract Account
  blockchains: ['ARC-TESTNET'],
  count: 1,
  walletSetId: userWalletSetId
})
```

### Agent Wallet

A dedicated "agent wallet" holds escrowed funds:

```bash
npm run generate-wallet
```

This script:
1. Creates a Circle wallet
2. Writes wallet ID and address to `.env.local`
3. Designates it as the escrow agent

### USDC Transfers

```typescript
// Transfer USDC to agent wallet (deposit)
const transfer = await client.createTransfer({
  source: {
    type: 'wallet',
    id: depositorWalletId
  },
  destination: {
    type: 'address',
    address: agentWalletAddress,
    chain: 'ARC-TESTNET'
  },
  amounts: [amountInUSDC],
  tokenId: USDC_TOKEN_ID
})

// Transfer USDC to beneficiary (release)
const release = await client.createTransfer({
  source: {
    type: 'wallet',
    id: agentWalletId
  },
  destination: {
    type: 'address',
    address: beneficiaryAddress,
    chain: 'ARC-TESTNET'
  },
  amounts: [amountInUSDC],
  tokenId: USDC_TOKEN_ID
})
```

---

## Smart Contract Integration

### EIP-712 Refund Protocol

The application uses Circle's Smart Contract Platform for the refund protocol:

```typescript
import { initiateSmartContractPlatformClient } from '@circle-fin/smart-contract-platform'

const scp = initiateSmartContractPlatformClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET
})

// Deploy refund contract
const contract = await scp.deployContract({
  walletId: agentWalletId,
  blockchain: 'ARC-TESTNET',
  contractTemplate: 'EIP712_REFUND',
  constructorParameters: [
    depositorAddress,
    beneficiaryAddress,
    amountInUSDC,
    refundDeadline
  ]
})
```

### Contract Functions

1. **`deposit()`**: Depositor sends USDC to contract
2. **`release()`**: Agent releases funds to beneficiary
3. **`refund()`**: Agent refunds to depositor
4. **`emergencyWithdraw()`**: Time-locked fallback

---

## OpenAI Validation

### Document Analysis

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Analyze submission
const response = await openai.chat.completions.create({
  model: 'gpt-4-vision-preview',
  messages: [
    {
      role: 'system',
      content: 'You are an expert at validating work deliverables against contract criteria.'
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Agreement criteria: ${criteria}` },
        { type: 'image_url', image_url: { url: deliverableURL } }
      ]
    }
  ]
})

// Parse AI decision
const validation = {
  approved: response.choices[0].message.content.includes('APPROVED'),
  reasoning: response.choices[0].message.content
}
```

### Supported File Types

- **Documents**: PDF (via pdf-parse), DOCX (via mammoth)
- **Images**: PNG, JPG, WEBP
- **Text**: TXT, MD

---

## Webhook System

### Circle Webhooks

Circle sends webhooks for transaction events:

```typescript
// /api/webhooks/circle
export async function POST(req: Request) {
  const signature = req.headers.get('circle-signature')
  const body = await req.text()
  
  // Verify signature
  const isValid = await verifyCircleSignature(signature, body)
  if (!isValid) return Response.json({ error: 'Invalid signature' }, { status: 401 })
  
  const event = JSON.parse(body)
  
  // Handle transfer events
  if (event.type === 'transfer.completed') {
    await supabase
      .from('agreements')
      .update({ status: 'funded' })
      .eq('id', event.transferId)
  }
  
  return Response.json({ received: true })
}
```

### Webhook Setup (Development)

1. Run `ngrok http 3000` to expose local server
2. Copy HTTPS URL (e.g., `https://abc123.ngrok.io`)
3. Configure in Circle Console:
   - URL: `https://abc123.ngrok.io/api/webhooks/circle`
   - Events: `transfer.*`

---

## Database Schema

### Tables

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  wallet_id TEXT,
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**agreements**
```sql
CREATE TABLE agreements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  depositor_id UUID REFERENCES users(id),
  beneficiary_id UUID REFERENCES users(id),
  amount NUMERIC NOT NULL,
  criteria TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  contract_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**submissions**
```sql
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agreement_id UUID REFERENCES agreements(id),
  file_url TEXT NOT NULL,
  validation_result JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row-Level Security (RLS)

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own agreements"
ON agreements FOR SELECT
USING (auth.uid() = depositor_id OR auth.uid() = beneficiary_id);

-- Only beneficiaries can submit
CREATE POLICY "Beneficiaries can submit"
ON submissions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM agreements
    WHERE id = agreement_id AND beneficiary_id = auth.uid()
  )
);
```

---

## Security Model

### Authentication
- **Supabase Auth**: Email/password with JWT tokens
- **Session management**: HTTP-only cookies
- **CSRF protection**: Built-in Next.js CSRF tokens

### API Security
- **Webhook verification**: Circle signature validation
- **Rate limiting**: Via Supabase (2 signups/hour default)
- **Input validation**: Zod schemas on all API routes

### Wallet Security
- **Developer-controlled**: Circle manages private keys
- **Entity secret**: Stored in environment variables
- **Testnet only**: No real funds at risk

### Data Security
- **RLS policies**: Database-level access control
- **Environment variables**: Secrets never in code
- **HTTPS only**: TLS for all communication

---

## Deployment Considerations

### Environment Setup
```bash
# Required for production
VERCEL_URL=https://your-domain.com
CIRCLE_API_KEY=live_key_xxx
CIRCLE_ENTITY_SECRET=xxx
OPENAI_API_KEY=sk-xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Circle Webhook Configuration
- Production URL: `https://your-domain.com/api/webhooks/circle`
- Subscribe to: `transfer.completed`, `transfer.failed`

### Supabase Production
- Enable RLS on all tables
- Configure custom SMTP for emails
- Set up database backups

---

## Further Reading

- [Circle Developer Controlled Wallets Docs](https://developers.circle.com/wallets/dev-controlled)
- [Arc Network Documentation](https://docs.arc.network)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Next.js App Router](https://nextjs.org/docs/app)
