import { getAddress, isAddress } from "viem";

export type AppConfig = {
  publicBaseUrl: string;
  x402Mock: boolean;
  x402Network: `${string}:${string}`;
  x402Price: string;
  x402PayTo: `0x${string}`;
  x402FacilitatorUrl: string;
  agentName: string;
  agentDescription: string;
  agentImageUrl: string;
  erc8004ChainId: number;
  erc8004IdentityRegistry?: `0x${string}`;
  erc8004ReputationRegistry?: `0x${string}`;
  erc8004ValidationRegistry?: `0x${string}`;
  erc8004SepoliaIdentityRegistry: `0x${string}`;
  erc8004SepoliaValidationRegistry: `0x${string}`;
  // ERC-8183 escrow showcase, Base Sepolia only (no canonical deployment exists).
  escrow8183Address: `0x${string}`;
  escrowTokenAddress: `0x${string}`;
};

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalAddress(name: string): `0x${string}` | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`${name} must be an EVM address`);
  return getAddress(value) as `0x${string}`;
}

function requiredAddress(name: string, fallback?: string): `0x${string}` {
  const value = required(name, fallback);
  if (!isAddress(value)) throw new Error(`${name} must be an EVM address`);
  return getAddress(value) as `0x${string}`;
}

function requiredNetwork(name: string, fallback?: `${string}:${string}`): `${string}:${string}` {
  const value = required(name, fallback);
  if (!value.includes(":")) throw new Error(`${name} must be a CAIP-2 network id like eip155:8453`);
  return value as `${string}:${string}`;
}

export function configFromEnv(): AppConfig {
  return {
    publicBaseUrl: required("PUBLIC_BASE_URL", "http://localhost:3000").replace(/\/$/, ""),
    x402Mock: (process.env.X402_MOCK ?? "true").toLowerCase() === "true",
    x402Network: requiredNetwork("X402_NETWORK", "eip155:8453"),
    x402Price: required("X402_PRICE", "$0.01"),
    x402PayTo: requiredAddress("X402_PAY_TO", "0x0000000000000000000000000000000000000000"),
    x402FacilitatorUrl: required("X402_FACILITATOR_URL", "https://facilitator.payai.network"),
    agentName: required("AGENT_NAME", "Banana Secret Agent"),
    agentDescription: required(
      "AGENT_DESCRIPTION",
      "Returns the secret after x402 payment: the best bananas are from ecuador.",
    ),
    agentImageUrl: required("AGENT_IMAGE_URL", "https://placehold.co/512x512/png?text=Banana+Agent"),
    erc8004ChainId: Number(required("ERC8004_CHAIN_ID", "8453")),
    erc8004IdentityRegistry: optionalAddress("ERC8004_IDENTITY_REGISTRY"),
    erc8004ReputationRegistry: optionalAddress("ERC8004_REPUTATION_REGISTRY"),
    erc8004ValidationRegistry: optionalAddress("ERC8004_VALIDATION_REGISTRY"),
    // Base Sepolia (84532) registries for the /validation playground.
    // The Validation Registry is only deployed on testnet; its linked Identity
    // Registry is NOT the canonical 0x8004A818... one, so register there.
    erc8004SepoliaIdentityRegistry: requiredAddress(
      "ERC8004_SEPOLIA_IDENTITY_REGISTRY",
      "0x8004AA63c570c570eBF15376c0dB199918BFe9Fb",
    ),
    erc8004SepoliaValidationRegistry: requiredAddress(
      "ERC8004_SEPOLIA_VALIDATION_REGISTRY",
      "0x8004C269D0A5647E51E121FeB226200ECE932d55",
    ),
    // Our own ERC-8183 escrow + a mock USDC faucet token on Base Sepolia.
    // ERC-8183 is a Draft with no canonical deployment, so we deploy our own.
    // Defaults are the zero address until `deploy:escrow` fills them in.
    escrow8183Address: requiredAddress(
      "ESCROW8183_ADDRESS",
      "0x0000000000000000000000000000000000000000",
    ),
    escrowTokenAddress: requiredAddress(
      "ESCROW_TOKEN_ADDRESS",
      "0x0000000000000000000000000000000000000000",
    ),
  };
}
