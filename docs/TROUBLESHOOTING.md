# Troubleshooting Guide

## Installation Issues

### Node version errors
Arc Escrow requires Node.js v22+.
Check your version: node --version
Install via nvm: nvm install 22 && nvm use 22

### npm vulnerability warnings
Fresh install shows ~21 vulnerabilities. These are non-critical dev dependencies.
Run: npm audit fix (avoid --force as it may break things)

### Docker not running
Supabase local requires Docker Desktop.
Start Docker Desktop before running: npx supabase start

### Supabase connection refused
Ensure Docker is running and ports 54321-54329 are free.
Try: npx supabase stop && npx supabase start

## API Key Issues

### Circle API key errors
Format: TEST_API_KEY:your-id:your-secret
Get from: https://console.circle.com/keys
Must be Testnet key for Arc Testnet

### Entity Secret errors
Generate once via Circle Console Configurator.
Store securely - Circle cannot recover it.
Register at: https://console.circle.com/wallets/dev/configurator

### OpenAI API key errors
Ensure key has sufficient credits.
Get from: https://platform.openai.com/api-keys

## Runtime Issues

### Webhook not receiving events
1. Start ngrok: ngrok http 3000
2. Copy HTTPS URL from ngrok output
3. Add to Circle Console webhooks
4. URL format: https://your-id.ngrok.io/api/webhooks/circle

### Database migration errors
Try resetting: npx supabase db reset
Then: npx supabase migration up

### Wallet generation fails
Check CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env.local
Run: npm run generate-wallet

### USDC not appearing
Arc Testnet faucet: https://faucet.circle.com
Select Arc Testnet and enter your wallet address

## Common Errors

### Error: malformed API key
Your Circle API key format is wrong.
Correct format: TEST_API_KEY:xxxxxxxx:xxxxxxxx

### Error: Entity Secret not registered
Complete the Circle Console Configurator step first.

### Error: insufficient USDC balance
Get testnet USDC from: https://faucet.circle.com

### Error: webhook signature invalid
Ensure CIRCLE_WEBHOOK_SECRET matches your Circle Console webhook secret.

## Arc Testnet Info

- Chain ID: 5042002
- RPC URL: https://rpc.testnet.arc.network
- Explorer: https://testnet.arcscan.app
- Faucet: https://faucet.circle.com

## FAQ

Q: Can I use this on mainnet?
A: No. This is testnet only and not production ready.

Q: Which Node.js version is recommended?
A: Node.js v22+ (tested on v22.22.3)

Q: How do I reset everything?
A: npx supabase db reset && npm run generate-wallet

Q: Where do I get testnet USDC?
A: https://faucet.circle.com - select Arc Testnet
