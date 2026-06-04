import { readFileSync } from "node:fs";
import { validationRegistryAbi } from "../src/erc8004Abi.js";
import { bytes32HashOfString, getClients, mustAddress, mustEnv, optionalEnv } from "./lib.js";

const { publicClient, walletClient, account } = getClients();
const validationRegistry = mustAddress("ERC8004_VALIDATION_REGISTRY");
const validatorAddress = mustAddress("VALIDATOR_ADDRESS");
const agentId = BigInt(mustEnv("AGENT_ID"));
const requestURI = optionalEnv("VALIDATION_REQUEST_URI") ?? `${mustEnv("PUBLIC_BASE_URL").replace(/\/$/, "")}/validation/banana-secret.json`;

// If VALIDATION_REQUEST_JSON_PATH is provided, hash the exact file contents.
// Otherwise hash the requestURI string as a stable local commitment placeholder.
const requestHash = optionalEnv("VALIDATION_REQUEST_JSON_PATH")
  ? bytes32HashOfString(readFileSync(mustEnv("VALIDATION_REQUEST_JSON_PATH"), "utf8"))
  : bytes32HashOfString(requestURI);

console.log("Requesting ERC-8004 validation");
console.log({ validationRegistry, validatorAddress, agentId: agentId.toString(), requestURI, requestHash });

const hash = await walletClient.writeContract({
  address: validationRegistry,
  abi: validationRegistryAbi,
  functionName: "validationRequest",
  args: [validatorAddress, agentId, requestURI, requestHash],
  account,
} as any);

console.log("Transaction submitted:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("Transaction confirmed in block:", receipt.blockNumber.toString());
console.log("Request hash for validator response:", requestHash);
