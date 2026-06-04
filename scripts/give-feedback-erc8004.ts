import { reputationRegistryAbi } from "../src/erc8004Abi.js";
import { bytes32HashOfString, getClients, mustAddress, mustEnv, optionalEnv } from "./lib.js";

const { publicClient, walletClient, account } = getClients();
const reputationRegistry = mustAddress("ERC8004_REPUTATION_REGISTRY");
const agentId = BigInt(mustEnv("AGENT_ID"));

const value = BigInt(process.env.FEEDBACK_VALUE ?? "100");
const valueDecimals = Number(process.env.FEEDBACK_VALUE_DECIMALS ?? "0");
const tag1 = process.env.FEEDBACK_TAG1 ?? "x402-paid-secret-delivery";
const tag2 = process.env.FEEDBACK_TAG2 ?? "buyer-review";
const endpoint = optionalEnv("FEEDBACK_ENDPOINT") ?? `${mustEnv("PUBLIC_BASE_URL").replace(/\/$/, "")}/secret`;
const feedbackURI = optionalEnv("FEEDBACK_URI") ?? `${mustEnv("PUBLIC_BASE_URL").replace(/\/$/, "")}/validation/banana-secret.json`;
const feedbackHash = optionalEnv("FEEDBACK_HASH") as `0x${string}` | undefined ?? bytes32HashOfString(feedbackURI);

console.log("Submitting ERC-8004 reputation feedback");
console.log({
  reputationRegistry,
  agentId: agentId.toString(),
  value: value.toString(),
  valueDecimals,
  tag1,
  tag2,
  endpoint,
  feedbackURI,
  feedbackHash,
  from: account.address,
});

const hash = await walletClient.writeContract({
  address: reputationRegistry,
  abi: reputationRegistryAbi,
  functionName: "giveFeedback",
  args: [agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash],
  account,
} as any);

console.log("Transaction submitted:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("Transaction confirmed in block:", receipt.blockNumber.toString());
