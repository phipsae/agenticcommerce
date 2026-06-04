import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { createPublicClient, createWalletClient, getAddress, http, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

config();

export function getChain(chainId: number) {
  if (chainId === 8453) return base;
  if (chainId === 84532) return baseSepolia;
  return {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [mustEnv("RPC_URL")] } },
  };
}

export function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it.`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function mustAddress(name: string): `0x${string}` {
  return getAddress(mustEnv(name)) as `0x${string}`;
}

export function getClients() {
  const chainId = Number(mustEnv("ERC8004_CHAIN_ID"));
  const chain = getChain(chainId);
  const rpcUrl = mustEnv("RPC_URL");
  const account = privateKeyToAccount(mustEnv("PRIVATE_KEY") as `0x${string}`);

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  return { chain, account, publicClient, walletClient };
}

export function bytes32HashOfString(value: string): `0x${string}` {
  return keccak256(stringToHex(value));
}

export function sha256HexOfFile(path: string): `0x${string}` {
  const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
  return `0x${digest}`;
}
