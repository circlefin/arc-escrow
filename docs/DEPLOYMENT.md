# Deployment Guide

## Prerequisites

- Vercel account
- Supabase account (cloud)
- Circle Developer Console account
- OpenAI API key

## Vercel Deployment

1. Push your fork to GitHub
2. Import project in Vercel dashboard
3. Add all environment variables (see below)
4. Deploy

## Environment Variables for Production

VERCEL_URL=https://your-app.vercel.app
NEXT_PUBLIC_VERCEL_URL=https://your-app.vercel.app
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_AGENT_WALLET_ID=auto-generated
NEXT_PUBLIC_AGENT_WALLET_ADDRESS=auto-generated
CIRCLE_API_KEY=TEST_API_KEY:your-id:your-secret
CIRCLE_ENTITY_SECRET=your-entity-secret
CIRCLE_BLOCKCHAIN=ARC-TESTNET
OPENAI_API_KEY=your-openai-key

## Supabase Production Setup

1. Create project at https://supabase.com
2. Get project URL and anon key from Settings > API
3. Link project: npx supabase link --project-ref your-ref
4. Push schema: npx supabase db push
5. Enable Row Level Security on all tables

## Circle Webhook Configuration

1. Deploy your app first
2. Go to Circle Console > Webhooks
3. Add endpoint: https://your-app.vercel.app/api/webhooks/circle
4. Copy webhook secret to environment variables

## Agent Wallet Setup

Run locally before deploying:
npm run generate-wallet

Copy the generated values to Vercel environment variables:
- NEXT_PUBLIC_AGENT_WALLET_ID
- NEXT_PUBLIC_AGENT_WALLET_ADDRESS
- CIRCLE_BLOCKCHAIN

## Arc Testnet Configuration

Network: Arc Testnet
Chain ID: 5042002
RPC URL: https://rpc.testnet.arc.network
USDC Contract: 0x3600000000000000000000000000000000000000
Explorer: https://testnet.arcscan.app
Faucet: https://faucet.circle.com

## Security Checklist

- Never expose CIRCLE_ENTITY_SECRET publicly
- Enable Supabase RLS on all tables
- Verify Circle webhook signatures
- Use HTTPS only in production
- Rotate API keys regularly

## Monitoring

- Vercel dashboard for deployment logs
- Supabase dashboard for database activity
- Circle Console for wallet transactions
- Arc Testnet Explorer: https://testnet.arcscan.app

## Note

This app is designed for testnet use only.
Do not use real funds or production Circle API keys.
