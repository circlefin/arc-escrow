# Arc Escrow Architecture

## System Overview

Arc Escrow is a Next.js application that enables trustless freelance agreements using USDC on Arc Testnet.

## Components

### Frontend
- Next.js 14 with App Router
- Tailwind CSS + shadcn/ui components
- Supabase Realtime for live updates

### Backend
- Next.js API routes
- Supabase for database and auth
- Circle Developer Controlled Wallets for USDC
- OpenAI for AI-powered deliverable validation

### Blockchain
- Arc Testnet (Chain ID: 5042002)
- Native USDC as gas token
- EIP-712 Refund Protocol smart contract
- Circle smart contract platform

## Data Flow

1. Client creates escrow agreement
2. Client deposits USDC into escrow wallet
3. Freelancer submits deliverable
4. AI (OpenAI) validates deliverable against criteria
5. If approved: USDC released to freelancer
6. If rejected: USDC refunded to client

## Circle Developer Controlled Wallets

The app uses Circle Developer Controlled Wallets for:
- Agent wallet: holds USDC escrow funds
- Transaction signing via Circle API
- Webhook notifications for payment events

Key contracts:
- USDC on Arc Testnet: 0x3600000000000000000000000000000000000000

## Supabase Schema

Tables:
- agreements: escrow contract details
- users: authenticated users
- deliverables: submitted work items
- transactions: payment history

## OpenAI Validation

The AI validation flow:
1. Freelancer uploads deliverable
2. App sends deliverable + criteria to OpenAI
3. OpenAI returns pass/fail with reasoning
4. Result triggers payment release or refund

## Webhook Architecture

Circle webhooks notify the app of:
- Deposit confirmations
- Payment completions
- Transaction failures

Webhook endpoint: /api/webhooks/circle
Signature verification: HMAC-SHA256

## Security Model

- Webhook signature verification
- Environment variables for all secrets
- Supabase Row Level Security (RLS)
- Testnet only — not production ready

## ERC-8183 Extension

For native Arc agentic commerce, see docs/erc8183-integration.md.
ERC-8183 provides trustless escrow with autonomous agent hiring.
AgenticCommerce: 0x0747EEf0706327138c69792bF28Cd525089e4583
