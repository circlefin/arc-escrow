# arc-escrow Troubleshooting Guide

## Table of Contents
- [Installation Issues](#installation-issues)
- [API Key Setup](#api-key-setup)
- [Database Issues](#database-issues)
- [Webhook Issues](#webhook-issues)
- [Runtime Errors](#runtime-errors)
- [Deployment Issues](#deployment-issues)
- [FAQ](#faq)

---

## Installation Issues

### Node Version Mismatch

**Problem:** README requires Node.js v22+, but you have v20.x

```bash
$ node --version
v20.20.1

$ npm install
# Works fine despite version requirement
```

**Solution:** Node v20.20.1+ works fine for this project. The README is overly strict.

**Why:** The project doesn't use Node 22-specific features. v20 LTS is sufficient.

**Recommendation:** Update README to specify `Node.js v20.20.1+` instead of v22+.

---

### npm Vulnerabilities on Fresh Install

**Problem:** Fresh `npm install` reports 21 vulnerabilities

```bash
$ npm install
# ...
21 vulnerabilities (2 low, 7 moderate, 8 high, 4 critical)
```

**Solution:** These are dependency vulnerabilities, mostly in dev dependencies. They don't affect runtime security for testnet usage.

**Action:**
```bash
# Review vulnerabilities
npm audit

# Fix non-breaking issues
npm audit fix

# Don't run --force unless you understand the risks
```

**When to worry:**
- ❌ Production deployment with real funds
- ✅ Testnet development (current use case)

---

### Deprecation Warnings

**Problem:** Multiple deprecation warnings during install
npm warn deprecated rimraf@3.0.2
npm warn deprecated npmlog@5.0.1
npm warn deprecated inflight@1.0.6
npm warn deprecated gauge@3.0.2

**Solution:** These are dependency warnings. They don't affect functionality.

**Why:** Dependencies haven't updated to newer package versions yet.

**Action:** Ignore for now. Not blocking.

---

### Docker Not Installed (Local Supabase)

**Problem:** `npx supabase start` fails with "Docker not found"

```bash
$ npx supabase start
Error: Docker is not running
```

**Solution:** Install Docker Desktop or use remote Supabase

**Option A - Install Docker:**
1. Download from https://www.docker.com/products/docker-desktop/
2. Install and start Docker Desktop
3. Verify: `docker --version`
4. Run `npx supabase start` again

**Option B - Use Remote Supabase:**
```bash
# Skip local, use cloud instead
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

---

### Supabase CLI Not Found

**Problem:** `npx supabase` command not recognized

**Solution:**
```bash
# Install globally
npm install -g supabase

# Or use npx (no install needed)
npx supabase --version
```

---

## API Key Setup

### Circle API Key Missing

**Problem:** `.env.local` needs `CIRCLE_API_KEY` but you don't know where to get it

**Solution:**
1. Go to https://console.circle.com/signin
2. Sign up / Log in
3. Navigate to **Settings → API Keys**
4. Click **Create API Key**
5. Select **Sandbox** environment (for testnet)
6. Copy the key (starts with `TEST_API_KEY:...`)
7. Add to `.env.local`:
```bash
CIRCLE_API_KEY=TEST_API_KEY:xxxxx
```

**Important:** Use **Sandbox** keys for Arc testnet, not Production keys.

---

### Circle Entity Secret Missing

**Problem:** Need `CIRCLE_ENTITY_SECRET` but setup unclear

**Solution:**
1. In Circle Console, go to **Settings → Entity Secrets**
2. If none exist, click **Generate Entity Secret**
3. **Save immediately** - you can't view it again!
4. Add to `.env.local`:
```bash
CIRCLE_ENTITY_SECRET=your-secret-here
```

**Security:** Never commit entity secrets to Git! They're like private keys.

---

### OpenAI API Key Issues

**Problem:** Need OpenAI API key for AI validation

**Solution:**
1. Go to https://platform.openai.com/api-keys
2. Sign up / Log in
3. Click **Create new secret key**
4. Give it a name (e.g., "arc-escrow-dev")
5. Copy the key (starts with `sk-...`)
6. Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-xxxxx
```

**Cost:** GPT-4 Vision costs ~$0.01-0.03 per validation. Budget accordingly.

---

### Wallet Generation Fails

**Problem:** `npm run generate-wallet` errors

```bash
$ npm run generate-wallet
Error: Invalid API credentials
```

**Solution:** Check your Circle credentials

```bash
# Verify .env.local has both:
CIRCLE_API_KEY=TEST_API_KEY:xxxxx
CIRCLE_ENTITY_SECRET=xxxxx

# Make sure no extra quotes or spaces
# Restart terminal after editing .env.local
```

**Common mistakes:**
- Using production keys instead of sandbox
- Entity secret expired or revoked
- Missing `TEST_API_KEY:` prefix

---

## Database Issues

### Supabase Connection Failed

**Problem:** App can't connect to Supabase
Error: Invalid Supabase URL or anon key

**Solution:** Check `.env.local` variables

**For Local Supabase:**
```bash
# After running "npx supabase start", copy output:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

**For Remote Supabase:**
```bash
# From Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

---

### Migration Failed

**Problem:** `npx supabase migration up` fails

```bash
Error: relation "users" already exists
```

**Solution:** Database already has tables

**Option A - Reset local database:**
```bash
npx supabase db reset
```

**Option B - Skip if tables exist:**
```bash
# Check if tables exist
npx supabase db diff

# If schema matches, you're good!
```

---

### Email Signup Rate Limit

**Problem:** "Email rate limit exceeded" when creating accounts

**Cause:** Supabase limits 2 email signups per hour (default)

**Solution (Local Supabase):**
1. Edit `supabase/config.toml`:
```toml
[auth.rate_limit]
enabled = false
```

2. Restart Supabase:
```bash
npx supabase stop
npx supabase start
```

**Solution (Remote Supabase):**
- Use real email addresses (not disposable)
- Wait 1 hour between signups
- Or add users manually in dashboard: **Authentication → Users**

---

### Email Verification Not Working

**Problem:** Verification emails not arriving

**Solution (Local Supabase):**
- Emails go to Inbucket: http://127.0.0.1:54324
- Check inbox there

**Solution (Remote Supabase):**
- Configure custom SMTP in dashboard
- Or disable email verification for dev:
  - **Authentication → Email Auth → Disable email confirmations**

---

## Webhook Issues

### ngrok Not Installed

**Problem:** Can't test webhooks locally

**Solution:**
```bash
# Install ngrok
# macOS:
brew install ngrok

# Linux:
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar xvf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Verify
ngrok --version
```

---

### ngrok Tunnel Not Working

**Problem:** `ngrok http 3000` fails

```bash
$ ngrok http 3000
ERROR: authentication required
```

**Solution:**
```bash
# Sign up at https://ngrok.com
# Get auth token from dashboard
ngrok authtoken <your-token>

# Try again
ngrok http 3000
```

---

### Webhooks Not Received

**Problem:** Circle sends webhooks but app doesn't receive them

**Checklist:**
1. ✅ ngrok running: `ngrok http 3000`
2. ✅ App running: `npm run dev`
3. ✅ Circle webhook configured with ngrok URL
4. ✅ URL format: `https://xxxx.ngrok.io/api/webhooks/circle`

**Test webhook:**
```bash
# Simulate a Circle webhook
curl -X POST http://localhost:3000/api/webhooks/circle \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":{}}'
```

**Check logs:**
```bash
# In Next.js console, you should see:
[webhook] Received: test
```

---

### Webhook Signature Verification Failed

**Problem:** Webhooks rejected with 401 Unauthorized

**Cause:** Circle signature verification failing

**Solution:**
```typescript
// Check signature verification in /api/webhooks/circle
const signature = req.headers.get('circle-signature')

// Make sure you're fetching Circle public key correctly
const publicKey = await fetchCirclePublicKey()
```

**Debug:**
- Log the signature
- Log the request body
- Verify Circle public key is being fetched

---

## Runtime Errors

### Wallet Not Found

**Problem:** "Wallet ID not found" when creating agreement

**Cause:** Agent wallet not generated

**Solution:**
```bash
npm run generate-wallet
```

This will populate:
- `NEXT_PUBLIC_AGENT_WALLET_ID`
- `NEXT_PUBLIC_AGENT_WALLET_ADDRESS`
- `CIRCLE_BLOCKCHAIN`

---

### USDC Transfer Failed

**Problem:** Transfer fails with "Insufficient balance"

**Cause:** Wallet has no testnet USDC

**Solution:**
1. Get testnet USDC from Arc faucet
2. Visit: https://faucet.arc.network
3. Enter your wallet address
4. Request USDC tokens

**Alternative:**
- Use a wallet that already has testnet USDC
- Or adjust agreement amount to match balance

---

### OpenAI Rate Limit

**Problem:** "Rate limit exceeded" when validating submissions

**Cause:** OpenAI API rate limits hit

**Solution:**
```bash
# Check your OpenAI usage:
# https://platform.openai.com/usage

# Upgrade tier if needed
# Or add delays between validations
```

---

### File Upload Failed

**Problem:** Submission upload returns 413 Payload Too Large

**Cause:** File exceeds Next.js limit (default 4.5MB)

**Solution:** Increase body size limit in `next.config.js`:
```javascript
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}
```

---

## Deployment Issues

### Environment Variables Not Set

**Problem:** Vercel deployment fails with missing env vars

**Solution:**
1. Go to Vercel dashboard → Project → Settings → Environment Variables
2. Add all variables from `.env.local`:
   - `CIRCLE_API_KEY`
   - `CIRCLE_ENTITY_SECRET`
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - etc.

**Important:** Use **Production** values, not testnet keys!

---

### Webhook URL Changed After Deploy

**Problem:** Webhooks point to old URL

**Solution:** Update in Circle Console

**Steps:**
1. Go to https://console.circle.com/webhooks
2. Edit webhook endpoint
3. Change URL to: `https://your-domain.vercel.app/api/webhooks/circle`
4. Save

---

### Database Connection Failed in Production

**Problem:** Can't connect to Supabase from Vercel

**Cause:** Wrong environment variables or RLS policies

**Solution:**
```bash
# Verify production Supabase credentials
# From Supabase Dashboard → Settings → API:
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Check RLS policies allow access
```

---

## FAQ

### Q: Can I use mainnet instead of testnet?

**A:** Not recommended. This is a demo app without production-grade security. Stick to Arc testnet.

---

### Q: How much does it cost to run?

**A:** 
- Arc testnet: Free (testnet USDC)
- OpenAI: ~$0.01-0.03 per validation
- Supabase: Free tier sufficient for dev
- Circle APIs: Free for testnet

---

### Q: Can I customize the AI validation logic?

**A:** Yes! Edit the OpenAI prompt in `/api/submissions/validate`. Adjust the criteria matching logic.

---

### Q: Why does wallet generation take so long?

**A:** Circle's API can be slow on testnet. Production is faster. If it hangs >30 seconds, check your API keys.

---

### Q: Can I test without OpenAI?

**A:** Yes! Mock the validation in `/api/submissions/validate`:
```typescript
// Temporary: Skip OpenAI, auto-approve
return { approved: true, reasoning: 'Auto-approved for testing' }
```

---

### Q: How do I reset everything and start fresh?

**A:**
```bash
# Stop Supabase
npx supabase stop

# Delete .env.local
rm .env.local

# Reinstall
rm -rf node_modules package-lock.json
npm install

# Start from scratch
cp .env.example .env.local
# Fill in values again
```

---

### Q: Where can I get help?

**Resources:**
- [Circle Developer Docs](https://developers.circle.com)
- [Arc Network Docs](https://docs.arc.network)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)

**Community:**
- Circle Discord: (check Circle website)
- Open an issue: https://github.com/circlefin/arc-escrow/issues

---

## Still Stuck?

If this guide didn't solve your problem:

1. **Check the logs:** `npm run dev` output usually shows the error
2. **Search issues:** Someone might have had the same problem
3. **Open an issue:** Provide full error message and steps to reproduce

**Good issue template:**
Problem
[Brief description]
Steps to Reproduce

Run X
Do Y
Error appears

Error Message
[Full error output]
Environment

Node version: [run node --version]
OS: [Mac/Linux/Windows]
What I tried: [list attempts]


---

**Happy debugging!** 🐛🔧
