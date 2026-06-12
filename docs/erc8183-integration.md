# ERC-8183 Integration Guide for Arc Escrow

This guide shows how to extend the Arc Escrow app with native ERC-8183 agentic commerce jobs on Arc Testnet.

## Why ERC-8183?

The current Arc Escrow app uses a custom EIP-712 Refund Protocol contract. ERC-8183 is Arc Testnet native standard for agentic commerce that provides:

- Trustless escrow with onchain job lifecycle
- Autonomous agent hiring (agents can hire sub-agents)
- Native USDC settlement on Arc Testnet
- Composable with ERC-8004 agent identity

## ERC-8183 Contract on Arc Testnet

AgenticCommerce: 0x0747EEf0706327138c69792bF28Cd525089e4583

## Job Lifecycle

createJob() -> setBudget() -> approve() -> fund() -> submit() -> complete()

Status values: 0=Open 1=Funded 2=Submitted 3=Completed 4=Rejected 5=Expired

## Integration Example

Replace the custom escrow contract calls with ERC-8183 using Circle Developer Controlled Wallets:

1. Create job: createJob(provider, evaluator, expiredAt, description, hook)
2. Approve USDC: approve(AgenticCommerce, budgetAmount)
3. Fund escrow: fund(jobId, optParams)
4. Submit deliverable: submit(jobId, deliverableHash, optParams)
5. Complete job: complete(jobId, reasonHash, optParams)

## AI Validation Flow

1. Client creates job with budget
2. Provider (AI agent) submits deliverable hash
3. Evaluator (Claude/OpenAI) validates the work offchain
4. If approved: evaluator calls complete() -> payment released
5. If rejected: evaluator calls reject() -> refund to client

## Live Example on Arc Testnet

Job ID: 110935 - Status: Completed - Budget: 5 USDC
Full implementation: https://github.com/consumeobeydie/arc-agent-api

Multi-agent extension: https://github.com/consumeobeydie/arc-multi-agent

## Resources

- Arc ERC-8183 Docs: https://docs.arc.network/arc/tutorials/create-your-first-erc-8183-job
- Arc Testnet Explorer: https://testnet.arcscan.app
- AgenticCommerce: https://testnet.arcscan.app/address/0x0747EEf0706327138c69792bF28Cd525089e4583
