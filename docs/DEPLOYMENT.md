# arc-escrow Deployment Guide

This guide covers deploying arc-escrow to production environments.

## Table of Contents
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Setup](#environment-setup)
- [Vercel Deployment](#vercel-deployment)
- [Supabase Production Setup](#supabase-production-setup)
- [Circle Configuration](#circle-configuration)
- [Domain and DNS](#domain-and-dns)
- [Monitoring and Logging](#monitoring-and-logging)
- [Security Hardening](#security-hardening)
- [Troubleshooting Deployment](#troubleshooting-deployment)

---

## Pre-Deployment Checklist

Before deploying to production, ensure:

### Code Quality
- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npm run lint`
- [ ] Build succeeds: `npm run build`

### Security
- [ ] All secrets in environment variables (not committed)
- [ ] API keys rotated from development
- [ ] Supabase RLS policies enabled
- [ ] Webhook signature verification enabled
- [ ] Rate limiting configured

### Documentation
- [ ] README.md updated
- [ ] Environment variables documented
- [ ] API endpoints documented

### Testing
- [ ] Tested on Arc testnet end-to-end
- [ ] Wallet creation works
- [ ] USDC transfers complete
- [ ] AI validation processes correctly
- [ ] Webhooks received and processed

---

## Environment Setup

### Production Environment Variables

Create a production `.env.production` file (do NOT commit this):

```bash
# Deployment
VERCEL_URL=https://your-app.vercel.app
NEXT_PUBLIC_VERCEL_URL=https://your-app.vercel.app

# Supabase Production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# USDC Smart Contract (Arc Mainnet)
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x...

# Agent Wallet (Production)
NEXT_PUBLIC_AGENT_WALLET_ID=wallet-id-here
NEXT_PUBLIC_AGENT_WALLET_ADDRESS=0x...

# Circle Production
CIRCLE_API_KEY=live_api_key_xxx
CIRCLE_ENTITY_SECRET=prod-entity-secret-xxx
CIRCLE_BLOCKCHAIN=ARC-MAINNET

# OpenAI
OPENAI_API_KEY=sk-prod-xxx
```

### Security Best Practices

**Never:**
- ❌ Commit production secrets to Git
- ❌ Share entity secrets publicly
- ❌ Use testnet keys in production
- ❌ Log sensitive data

**Always:**
- ✅ Use environment-specific secrets
- ✅ Rotate keys regularly
- ✅ Use secret management tools
- ✅ Enable audit logging

---

## Vercel Deployment

### Step 1: Connect Repository

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import your `arc-escrow` repository
5. Select the repository

### Step 2: Configure Project

**Framework Preset:** Next.js

**Build Command:**
```bash
npm run build
```

**Output Directory:**
.next

**Install Command:**
```bash
npm install
```

**Node Version:** 20.x

### Step 3: Environment Variables

Add all production environment variables:

1. Go to **Settings → Environment Variables**
2. Add each variable:
   - `CIRCLE_API_KEY`
   - `CIRCLE_ENTITY_SECRET`
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - etc.

**Important:** Select **"Production"** environment for each!

### Step 4: Deploy

Click **"Deploy"**

Vercel will:
1. Install dependencies
2. Build the project
3. Deploy to production
4. Provide a URL (e.g., `https://arc-escrow.vercel.app`)

### Step 5: Verify Deployment

1. Visit your deployment URL
2. Test core functionality:
   - User signup/login
   - Create agreement
   - Upload submission
   - Check webhook receipt

---

## Supabase Production Setup

### Step 1: Create Production Project

1. Go to https://supabase.com
2. Click **"New Project"**
3. Fill in details:
   - **Name:** arc-escrow-prod
   - **Database Password:** (strong password)
   - **Region:** (closest to users)
4. Wait for project creation (~2 minutes)

### Step 2: Run Migrations

```bash
# Link to production project
npx supabase link --project-ref your-prod-ref

# Push database schema
npx supabase db push

# Verify tables exist
npx supabase db diff
```

### Step 3: Enable Row-Level Security (RLS)

**Critical:** RLS must be enabled in production!

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Agreement policies
CREATE POLICY "Users can view their agreements"
  ON agreements FOR SELECT
  USING (
    auth.uid() = depositor_id OR 
    auth.uid() = beneficiary_id
  );

CREATE POLICY "Users can create agreements"
  ON agreements FOR INSERT
  WITH CHECK (auth.uid() = depositor_id);

-- Submission policies
CREATE POLICY "Beneficiaries can submit"
  ON submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agreements
      WHERE id = agreement_id 
      AND beneficiary_id = auth.uid()
    )
  );

CREATE POLICY "Users can view related submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agreements
      WHERE id = agreement_id 
      AND (depositor_id = auth.uid() OR beneficiary_id = auth.uid())
    )
  );
```

### Step 4: Configure Auth

In Supabase Dashboard → **Authentication → Providers**:

1. **Email Auth:**
   - Enable email confirmations
   - Configure custom SMTP (recommended)
   - Set redirect URLs: `https://your-app.vercel.app/auth/callback`

2. **Security:**
   - Set session timeout (e.g., 7 days)
   - Enable captcha on signup (optional)
   - Configure rate limits

### Step 5: Storage Setup

If using file storage:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    bucket_id = 'submissions'
  );

CREATE POLICY "Users can view their files"
  ON storage.objects FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    bucket_id = 'submissions'
  );
```

### Step 6: Get Production Credentials

From Supabase Dashboard → **Settings → API**:

Copy to your environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for server-side operations)

---

## Circle Configuration

### Step 1: Create Production API Keys

1. Go to https://console.circle.com
2. Navigate to **Settings → API Keys**
3. Create **Production** API key (not Sandbox)
4. Save securely: `CIRCLE_API_KEY=live_api_key_xxx`

### Step 2: Generate Entity Secret

1. Go to **Settings → Entity Secrets**
2. Click **"Generate Entity Secret"**
3. **Save immediately** - can't view again!
4. Store securely: `CIRCLE_ENTITY_SECRET=xxx`

### Step 3: Generate Production Agent Wallet

**Locally**, with production credentials:

```bash
# Set production env vars temporarily
export CIRCLE_API_KEY=live_api_key_xxx
export CIRCLE_ENTITY_SECRET=xxx
export CIRCLE_BLOCKCHAIN=ARC-MAINNET

# Generate wallet
node generate-wallet.mjs

# Copy output to production .env
NEXT_PUBLIC_AGENT_WALLET_ID=xxx
NEXT_PUBLIC_AGENT_WALLET_ADDRESS=0x...
CIRCLE_BLOCKCHAIN=ARC-MAINNET
```

### Step 4: Configure Webhooks

1. Go to **Circle Console → Webhooks**
2. Click **"Add Endpoint"**
3. Enter production URL:
https://your-app.vercel.app/api/webhooks/circle
4. Select events:
   - `transfer.completed`
   - `transfer.failed`
   - `wallet.created`
5. Save webhook ID and secret

**Test webhook:**
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/circle \
  -H "Content-Type: application/json" \
  -H "circle-signature: test" \
  -d '{"type":"test"}'
```

### Step 5: Fund Agent Wallet

On Arc mainnet, ensure agent wallet has sufficient USDC for gas fees:

```bash
# Check balance
curl https://api.circle.com/v1/wallets/$AGENT_WALLET_ID/balances \
  -H "Authorization: Bearer $CIRCLE_API_KEY"

# If low, transfer USDC from your main wallet
```

---

## Domain and DNS

### Step 1: Add Custom Domain

In Vercel Dashboard → **Settings → Domains**:

1. Click **"Add Domain"**
2. Enter your domain: `escrow.yourdomain.com`
3. Follow DNS instructions

### Step 2: Configure DNS

Add these records to your DNS provider:

**Option A - CNAME (recommended):**
escrow  CNAME  cname.vercel-dns.com

**Option B - A Record:**
escrow  A  76.76.21.21

### Step 3: Enable HTTPS

Vercel automatically provisions SSL certificates via Let's Encrypt.

Wait ~1 minute, then verify: `https://escrow.yourdomain.com`

### Step 4: Update Environment Variables

Update all URLs in Vercel environment variables:
```bash
VERCEL_URL=https://escrow.yourdomain.com
NEXT_PUBLIC_VERCEL_URL=https://escrow.yourdomain.com
```

### Step 5: Update Circle Webhooks

Update webhook URL to use custom domain:
https://escrow.yourdomain.com/api/webhooks/circle

---

## Monitoring and Logging

### Vercel Logs

View logs in Vercel Dashboard → **Deployments → [Your Deployment] → Logs**

**Log aggregation tools:**
- Datadog
- Sentry
- LogRocket

### Error Tracking

Install Sentry for error monitoring:

```bash
npm install @sentry/nextjs
```

Configure `sentry.client.config.ts`:
```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

### Uptime Monitoring

Use services like:
- **UptimeRobot** (free)
- **Pingdom**
- **Better Uptime**

Monitor:
- `https://your-app.vercel.app/api/health`
- Response time < 200ms
- Uptime > 99.9%

### Database Monitoring

In Supabase Dashboard → **Settings → Monitoring**:

Watch:
- Active connections
- Query performance
- Storage usage
- API response times

---

## Security Hardening

### Step 1: Content Security Policy

Add to `next.config.js`:

```javascript
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
        ],
      },
    ]
  },
}
```

### Step 2: Rate Limiting

Implement rate limiting on API routes:

```typescript
// lib/rateLimiter.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
})

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
})

// Use in API routes
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { success } = await ratelimit.limit(ip)
  
  if (!success) {
    return new Response('Too many requests', { status: 429 })
  }
  
  // Continue...
}
```

### Step 3: Input Validation

Use Zod for all API inputs:

```typescript
import { z } from 'zod'

const createAgreementSchema = z.object({
  beneficiaryId: z.string().uuid(),
  amount: z.number().positive().max(1000000),
  criteria: z.string().min(10).max(5000),
})

export async function POST(req: Request) {
  const body = await req.json()
  
  // Validate
  const result = createAgreementSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    )
  }
  
  // Process validated data
  const { beneficiaryId, amount, criteria } = result.data
}
```

### Step 4: CORS Configuration

Restrict API access:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  
  // Only allow requests from your domain
  if (origin && !origin.includes('yourdomain.com')) {
    return new NextResponse(null, { status: 403 })
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

---

## Troubleshooting Deployment

### Build Fails

**Problem:** `npm run build` fails on Vercel

**Solutions:**
```bash
# Check build locally first
npm run build

# Common issues:
# - TypeScript errors: Fix all type issues
# - Missing env vars: Add to Vercel dashboard
# - Import errors: Check all imports are correct
```

### Environment Variables Not Working

**Problem:** App can't access environment variables

**Solutions:**
1. Check variable names match exactly (case-sensitive)
2. Verify "Production" environment is selected
3. Redeploy after adding variables
4. Use `NEXT_PUBLIC_` prefix for client-side vars

### Webhooks Not Received

**Problem:** Circle webhooks not reaching production

**Checklist:**
- [ ] Webhook URL is HTTPS
- [ ] URL is correct: `https://domain.com/api/webhooks/circle`
- [ ] Endpoint returns 200 OK
- [ ] Signature verification works
- [ ] Check Vercel function logs

**Test manually:**
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/circle \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":{}}'
```

### Database Connection Failed

**Problem:** Can't connect to Supabase from Vercel

**Solutions:**
1. Verify Supabase URL and keys are correct
2. Check RLS policies allow access
3. Ensure service role key for server-side operations
4. Test connection locally with production credentials

### Performance Issues

**Problem:** App is slow in production

**Solutions:**
- Enable Vercel Edge Functions for API routes
- Add database indexes:
```sql
  CREATE INDEX idx_agreements_depositor ON agreements(depositor_id);
  CREATE INDEX idx_agreements_beneficiary ON agreements(beneficiary_id);
  CREATE INDEX idx_submissions_agreement ON submissions(agreement_id);
```
- Use Vercel Analytics to identify bottlenecks
- Cache frequently accessed data

---

## Rollback Procedure

If deployment fails:

### Step 1: Revert in Vercel
1. Go to **Deployments**
2. Find previous working deployment
3. Click **"..."** → **"Promote to Production"**

### Step 2: Revert Database
```bash
# Rollback last migration
npx supabase db reset

# Or restore from backup
# (configure automatic backups in Supabase)
```

### Step 3: Notify Users
- Post status update
- Estimate recovery time
- Provide workarounds if possible

---

## Post-Deployment

### Monitor First 24 Hours
- Check error rates
- Watch for failed transactions
- Monitor webhook delivery
- Review user feedback

### Set Up Alerts
- Email alerts for errors
- Slack notifications for critical issues
- PagerDuty for on-call (if needed)

### Documentation
- Update runbook with deployment date
- Document any issues encountered
- Share learnings with team

---

## Production Checklist

Before considering deployment complete:

- [ ] All core features tested on production
- [ ] Monitoring and logging configured
- [ ] Error tracking setup
- [ ] Backups configured
- [ ] Security headers enabled
- [ ] Rate limiting active
- [ ] RLS policies verified
- [ ] Webhooks tested
- [ ] Performance acceptable
- [ ] Team trained on rollback procedure

---

## Further Reading

- [Vercel Deployment Docs](https://vercel.com/docs)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [Circle Production Best Practices](https://developers.circle.com/docs/best-practices)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

**Congratulations on deploying to production!** 🚀
