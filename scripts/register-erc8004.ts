import { decodeEventLog } from "viem";
import { identityRegistryAbi } from "../src/erc8004Abi.js";
import { getClients, mustAddress, mustEnv, optionalEnv } from "./lib.js";

const { publicClient, walletClient, account } = getClients();
const identityRegistry = mustAddress("ERC8004_IDENTITY_REGISTRY");
const agentURI = optionalEnv("AGENT_URI") ?? `${mustEnv("PUBLIC_BASE_URL").replace(/\/$/, "")}/.well-known/agent-registration.json`;

console.log("Registering ERC-8004 agent");
console.log({ identityRegistry, agentURI, owner: account.address });

const hash = await walletClient.writeContract({
  address: identityRegistry,
  abi: identityRegistryAbi,
  functionName: "register",
  args: [agentURI],
  account,
});

console.log("Transaction submitted:", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log("Transaction confirmed in block:", receipt.blockNumber.toString());

let agentId: bigint | undefined;
for (const log of receipt.logs) {
  try {
    const decoded = decodeEventLog({ abi: identityRegistryAbi, data: log.data, topics: log.topics });
    if (decoded.eventName === "Registered") {
      agentId = decoded.args.agentId;
      break;
    }
  } catch {
    // Not an ERC-8004 Registered event.
  }
}

if (agentId !== undefined) {
  console.log("Registered agentId:", agentId.toString());
  console.log("Next: set AGENT_ID=", agentId.toString());
} else {
  console.log("Registered event not decoded. Check the transaction logs for the agentId.");
}
