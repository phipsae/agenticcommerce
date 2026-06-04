# Banana Secret Agent MVP

A tiny agentic service that sells one secret via `x402` and exposes ERC-8004 metadata/reputation/validation hooks.

Secret returned after payment:

```txt
the best bananas are from ecuador
```

## What is implemented

- `GET /secret`
  - local/mock mode: returns HTTP `402` without an `X-PAYMENT` header
  - local/mock mode: returns the secret with an `X-PAYMENT` header
  - production mode: uses `@x402/express` middleware for x402 payment handling
- `GET /.well-known/agent-registration.json`
  - ERC-8004-style registration metadata with service, x402, reputation, and validation fields
- `GET /validation/banana-secret.json`
  - public evidence object for the `x402-paid-secret-delivery` validation category
- ERC-8004 scripts:
  - `npm run register:erc8004`
  - `npm run give-feedback:erc8004`
  - `npm run request-validation:erc8004`

## Local development

```bash
cd /home/parallels/agenticcomerce
npm install
cp .env.example .env
npm run dev
```

In another terminal:

```bash
curl -i http://localhost:3000/secret
curl -s -H 'X-PAYMENT: local-dev-paid' http://localhost:3000/secret | jq
curl -s http://localhost:3000/.well-known/agent-registration.json | jq
curl -s http://localhost:3000/validation/banana-secret.json | jq
```

## Verification

```bash
npm test
npm run build
```

Expected result:

- 5 tests pass
- TypeScript build succeeds

## Vercel deployment

This repo includes a Vercel serverless adapter:

- `api/index.ts`: exports the Express app for Vercel
- `vercel.json`: rewrites all routes to the serverless app

Deploy with the Vercel CLI:

```bash
npm install -g vercel
vercel login
cd /home/parallels/agenticcomerce
vercel
```

For a local Vercel build check after linking a project:

```bash
vercel pull --yes
vercel build
```

Without a linked Vercel project or `VERCEL_TOKEN`, `vercel build` will stop with `No Project Settings found locally`.

Set production environment variables in Vercel:

```bash
vercel env add PUBLIC_BASE_URL production
vercel env add X402_MOCK production
vercel env add X402_NETWORK production
vercel env add X402_PRICE production
vercel env add X402_PAY_TO production
vercel env add X402_FACILITATOR_URL production
vercel env add ERC8004_CHAIN_ID production
vercel env add ERC8004_IDENTITY_REGISTRY production
vercel env add ERC8004_REPUTATION_REGISTRY production
vercel env add ERC8004_VALIDATION_REGISTRY production
```

Recommended production values:

```txt
PUBLIC_BASE_URL=https://<your-vercel-project>.vercel.app
X402_MOCK=false
X402_NETWORK=eip155:8453
X402_PRICE=$0.01
ERC8004_CHAIN_ID=8453
```

Do not put `PRIVATE_KEY` in Vercel unless the deployed service itself must send transactions. For this MVP, keep `PRIVATE_KEY` local and use it only for the registration scripts.

After deploy, verify:

```bash
curl https://<your-vercel-project>.vercel.app/health
curl https://<your-vercel-project>.vercel.app/.well-known/agent-registration.json
curl https://<your-vercel-project>.vercel.app/validation/banana-secret.json
```

## Environment variables

Copy `.env.example` to `.env` and fill values.

Important variables:

- `PUBLIC_BASE_URL`: public HTTPS URL of the deployed service. ERC-8004 registration should point to this, not `localhost`.
- `X402_MOCK`: `true` for local development, `false` for production x402.
- `X402_NETWORK`: `eip155:8453` for Base mainnet.
- `X402_PRICE`: example `$0.01`.
- `X402_PAY_TO`: your receiving wallet for x402 payments.
- `X402_FACILITATOR_URL`: x402 facilitator URL.
- `RPC_URL`: Base mainnet RPC URL for registration scripts.
- `PRIVATE_KEY`: wallet key used to register/update ERC-8004. Do not commit this.
- `ERC8004_CHAIN_ID`: `8453` for Base mainnet.
- `ERC8004_IDENTITY_REGISTRY`: Identity Registry contract address.
- `ERC8004_REPUTATION_REGISTRY`: Reputation Registry contract address.
- `ERC8004_VALIDATION_REGISTRY`: Validation Registry contract address.
- `AGENT_ID`: set after successful ERC-8004 registration.

## Register on ERC-8004

Prerequisites:

1. Deploy the service to a public HTTPS URL.
2. Set `PUBLIC_BASE_URL` to that URL.
3. Set `X402_MOCK=false` for real payments.
4. Set `X402_PAY_TO` to your receiving address.
5. Fund the registration wallet with ETH on Base for gas.
6. Fill `RPC_URL`, `PRIVATE_KEY`, and the ERC-8004 registry addresses in `.env`.

Then run:

```bash
npm run register:erc8004
```

The script calls:

```solidity
register(string agentURI) returns (uint256 agentId)
```

with:

```txt
<PUBLIC_BASE_URL>/.well-known/agent-registration.json
```

After it prints the `agentId`, add this to `.env`:

```bash
AGENT_ID=<printed id>
```

Then update/redeploy metadata if you want the registration JSON to include the final `agentId`.

## Feedback / reviews

A buyer or reviewer wallet can submit reputation feedback:

```bash
npm run give-feedback:erc8004
```

Default tags:

- `tag1`: `x402-paid-secret-delivery`
- `tag2`: `buyer-review`
- score: `100` with `0` decimals

This is a review/reputation signal, not neutral validation.

## Validation request

The agent owner can request a validator to validate the service:

```bash
VALIDATOR_ADDRESS=0x... npm run request-validation:erc8004
```

The validation request points to:

```txt
<PUBLIC_BASE_URL>/validation/banana-secret.json
```

Recommended validation category:

```txt
x402-paid-secret-delivery
```

Suggested rubric:

- `100`: unpaid request returns 402, payment succeeds, paid response returns expected secret
- `50`: payment works but response is wrong or inconsistent
- `0`: payment fails, endpoint offline, or no secret delivered

## Trust wording for the article/presentation

Use this wording:

```txt
ERC-8004 records who said what about the agent and when.
It does not make every claim automatically true or neutral.
For this MVP, the validation evidence is provider-funded/self-test evidence.
Higher-neutrality validation would require buyer-funded, marketplace-funded,
randomly assigned, or economically bonded validators.
```

## ERC-8183 note

ERC-8183 escrow is intentionally not forced into this banana MVP. A single paid secret fits x402 directly. ERC-8183 becomes useful for longer agent jobs where funds should be escrowed and released only after task completion or dispute resolution.
