# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MVP "Banana Secret Agent": an Express service that sells one secret (`the best bananas are from ecuador`) via x402 payments on Base, plus ERC-8004 on-chain registration/reputation/validation tooling. ESM TypeScript, Node >= 22.

## Commands

```bash
npm run dev          # tsx watch src/server.ts (local server on :3000)
npm test             # vitest run tests (5 tests, supertest against the Express app)
npm run test:watch
npm run build        # tsc to dist/

# Run a single test
npx vitest run tests/app.test.ts -t "health"

# On-chain scripts (need RPC_URL, PRIVATE_KEY, registry addresses in .env)
npm run register:erc8004
npm run give-feedback:erc8004
VALIDATOR_ADDRESS=0x... npm run request-validation:erc8004
```

Local smoke test: `curl -i http://localhost:3000/secret` (expect 402), then with `-H 'X-PAYMENT: local-dev-paid'` (expect the secret).

## Architecture

Two deploy targets share one app factory:

- `src/app.ts`: `createApp(config)` builds the Express app. Order matters: `/health`, `/.well-known/agent-registration.json`, and `/validation/banana-secret.json` are registered BEFORE the payment middleware so they stay free; `/secret` comes after and is paywalled.
- `src/server.ts`: local entry point. `api/index.ts`: Vercel serverless entry (exports the app; `vercel.json` rewrites all routes to it).
- `src/config.ts`: `configFromEnv()` reads and validates all env vars (every var has a dev-friendly default, so the app boots with no `.env`). Tests bypass env entirely by passing a literal `AppConfig` to `createApp`.
- `src/payment.ts`: `createPaymentMiddleware(config)` has two modes switched by `X402_MOCK`:
  - mock (`true`, the default): any `X-PAYMENT` header counts as paid; otherwise return 402 with x402-style `accepts` JSON. Tests rely on this mode.
  - real (`false`): `@x402/express` middleware with `HTTPFacilitatorClient` + `ExactEvmScheme`.
- `src/metadata.ts`: builds the ERC-8004 registration JSON and validation evidence JSON from config. `src/secret.ts` exports `SECRET` and its sha256 `secretHash`, referenced in both metadata and the paid response.
- `scripts/`: standalone tsx scripts (viem) for ERC-8004 Identity/Reputation/Validation registry calls. Shared helpers in `scripts/lib.ts` (`getClients`, `mustEnv`, chain selection: 8453 Base, 84532 Base Sepolia). ABIs in `src/erc8004Abi.ts`.

## Deployment facts (learned the hard way)

- Production: https://agenticcommerce-mvp.vercel.app (Vercel project `agenticcommerce`, team `phipsaes-projects`, auto-deploys on push to main). Verified end to end with a real 1-cent USDC payment on Base mainnet.
- Facilitators: `facilitator.x402.org` is dead; `x402.org/facilitator` is testnet-only; production uses `https://facilitator.payai.network` (Base mainnet, no API keys); Coinbase CDP requires API keys. Check with `curl <url>/supported`.
- `vercel.json` needs `"framework": null` (Vercel's Express preset otherwise builds a broken second function from `src/app.ts`) and the repo needs the empty `public/` dir.
- `app.set("trust proxy", true)` is required: without it the x402 middleware advertises an `http://` resource URL behind Vercel's proxy and the browser paywall fails with mixed-content "Failed to fetch".
- `/secret` serves the `@x402/paywall` wallet UI for `Accept: text/html`, raw 402 JSON + `payment-required` header otherwise.

## Conventions

- ESM throughout: relative imports use `.js` extensions even in `.ts` files.
- Network ids are CAIP-2 (`eip155:8453`). `x402Network !== "eip155:8453"` is treated as testnet.
- `PRIVATE_KEY` is for local registration scripts only; do not deploy it to Vercel.
- After `register:erc8004` prints an agentId, set `AGENT_ID` in `.env`.
