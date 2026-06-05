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
  };
}
