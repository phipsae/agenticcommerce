import type { AppConfig } from "./config.js";

// Browser playground for the ERC-8004 Validation Registry on Base Sepolia.
// The registry is testnet-only (no Base mainnet deployment), so this page is
// hard-pinned to chain 84532 while the rest of the app stays on mainnet.
// Walks the full flow with one wallet: register a throwaway agent, submit
// validationRequest, answer it as the validator, then read the results.
export function validationPage(config: AppConfig): string {
  const prefill = {
    identityRegistry: config.erc8004SepoliaIdentityRegistry,
    validationRegistry: config.erc8004SepoliaValidationRegistry,
    requestURI: `${config.publicBaseUrl}/validation/banana-secret.json`,
    tag: "x402-paid-secret-delivery",
    agentName: config.agentName,
    chainId: 84532,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Validation playground (ERC-8004, Base Sepolia)</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, sans-serif; background: #f6f8fa; margin: 0; padding: 2rem 1rem; }
  main { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { font-size: 1.4rem; margin-top: 0; }
  h2 { font-size: 1.05rem; margin: 1.8rem 0 .4rem; border-top: 1px solid #d8dee4; padding-top: 1.2rem; }
  label { display: block; font-size: .85rem; font-weight: 600; margin: .9rem 0 .25rem; }
  input { width: 100%; box-sizing: border-box; padding: .5rem .6rem; border: 1px solid #d0d7de; border-radius: 6px; font-size: .9rem; font-family: inherit; }
  button { margin-top: 1rem; margin-right: .5rem; padding: .6rem 1.2rem; font-size: .95rem; border: 0; border-radius: 8px; background: #3b5bf6; color: #fff; cursor: pointer; }
  button:disabled { background: #9aa7b1; cursor: not-allowed; }
  pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: .8rem; font-size: .75rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
  .status { margin-top: 1rem; font-size: .9rem; }
  .ok { color: #1a7f37; } .err { color: #cf222e; }
  .hint { font-size: .78rem; color: #57606a; margin-top: .2rem; }
</style>
</head>
<body>
<main>
  <h1>ERC-8004 validation playground (Base Sepolia)</h1>
  <p>The Validation Registry is only deployed on Base Sepolia, so everything here runs on testnet. You play both roles: the agent owner requesting validation and the validator answering it. You need Base Sepolia ETH (<a href="https://portal.cdp.coinbase.com/products/faucet" target="_blank" rel="noopener">faucet</a>).</p>
  <button id="connect">Connect wallet</button>
  <div class="status" id="connectStatus"></div>

  <h2>Step 0: Register a test agent</h2>
  <p class="hint">validationRequest must come from the owner of an agentId on the Identity Registry the Validation Registry is linked to (<code>${config.erc8004SepoliaIdentityRegistry}</code>, not the canonical 0x8004A818... one). Skip if you already have one.</p>
  <button id="register" disabled>Register test agent</button>
  <div class="status" id="registerStatus"></div>

  <h2>Step 1: Request validation</h2>
  <label>Agent ID</label>
  <input id="agentId" type="number" min="0" placeholder="filled by step 0, or enter your Sepolia agentId">
  <label>Validator address</label>
  <input id="validator" placeholder="filled with your wallet on connect, so you can answer yourself">
  <label>Request URI (the evidence the validator should check)</label>
  <input id="requestURI" value="${prefill.requestURI}">
  <label>Request hash (keccak256 of the URI string, auto-computed)</label>
  <pre id="requestHash"></pre>
  <button id="request" disabled>Send validationRequest</button>
  <div class="status" id="requestStatus"></div>

  <h2>Step 2: Respond as the validator</h2>
  <p class="hint">Must be sent from the validator wallet chosen in step 1.</p>
  <label>Request hash</label>
  <input id="respondHash" placeholder="filled by step 1">
  <label>Response score (0-100)</label>
  <input id="response" type="number" min="0" max="100" value="100">
  <label>Response URI (optional evidence of the validation result)</label>
  <input id="responseURI" placeholder="leave empty for none">
  <label>Tag</label>
  <input id="tag" value="${prefill.tag}">
  <button id="respond" disabled>Send validationResponse</button>
  <div class="status" id="respondStatus"></div>

  <h2>Step 3: Read the registry</h2>
  <button id="readStatus" disabled>getValidationStatus</button>
  <button id="readSummary" disabled>getSummary</button>
  <button id="readList" disabled>getAgentValidations</button>
  <pre id="readOut"></pre>
  <div class="status" id="readStatusMsg"></div>
</main>

<script type="module">
import { createWalletClient, createPublicClient, custom, keccak256, stringToHex, decodeEventLog } from "https://esm.sh/viem@2";
import { baseSepolia } from "https://esm.sh/viem@2/chains";

const prefill = ${JSON.stringify(prefill)};
const identityAbi = [
  { type: "function", name: "register", stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] },
  { type: "event", name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ] },
];
const validationAbi = [
  { type: "function", name: "validationRequest", stateMutability: "nonpayable",
    inputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "requestURI", type: "string" },
      { name: "requestHash", type: "bytes32" },
    ], outputs: [] },
  { type: "function", name: "validationResponse", stateMutability: "nonpayable",
    inputs: [
      { name: "requestHash", type: "bytes32" },
      { name: "response", type: "uint8" },
      { name: "responseURI", type: "string" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
    ], outputs: [] },
  { type: "function", name: "getValidationStatus", stateMutability: "view",
    inputs: [{ name: "requestHash", type: "bytes32" }],
    outputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "response", type: "uint8" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
      { name: "lastUpdate", type: "uint256" },
    ] },
  { type: "function", name: "getSummary", stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "validatorAddresses", type: "address[]" },
      { name: "tag", type: "string" },
    ],
    outputs: [
      { name: "count", type: "uint64" },
      { name: "avgResponse", type: "uint8" },
    ] },
  { type: "function", name: "getAgentValidations", stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32[]" }] },
];

const $ = (id) => document.getElementById(id);
const ZERO_HASH = "0x" + "0".repeat(64);
const status = (id, msg, cls = "") => { $(id).textContent = msg; $(id).className = "status " + cls; };
const json = (v) => JSON.stringify(v, (_k, x) => typeof x === "bigint" ? x.toString() : x, 2);

let account = null;
let walletClient = null;
let publicClient = null;

function refreshHash() {
  $("requestHash").textContent = keccak256(stringToHex($("requestURI").value));
}
$("requestURI").addEventListener("input", refreshHash);
refreshHash();

$("connect").addEventListener("click", async () => {
  try {
    if (!window.ethereum) { status("connectStatus", "No browser wallet found. Install MetaMask or Rabby.", "err"); return; }
    walletClient = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
    [account] = await walletClient.requestAddresses();
    try {
      await walletClient.switchChain({ id: baseSepolia.id });
    } catch (e) {
      // MetaMask reports -32603 "internal error" instead of the spec'd 4902
      // when the chain isn't added yet, so on any failure that isn't a user
      // rejection, add Base Sepolia and switch again.
      if (e.code === 4001 || e.cause?.code === 4001) throw e;
      await walletClient.addChain({ chain: baseSepolia });
      await walletClient.switchChain({ id: baseSepolia.id });
    }
    publicClient = createPublicClient({ chain: baseSepolia, transport: custom(window.ethereum) });
    if (!$("validator").value) $("validator").value = account;
    for (const id of ["register", "request", "respond", "readStatus", "readSummary", "readList"]) $(id).disabled = false;
    $("connect").disabled = true;
    status("connectStatus", "Connected: " + account + " (Base Sepolia).", "ok");
  } catch (e) {
    status("connectStatus", e.shortMessage || e.message || String(e), "err");
  }
});

$("register").addEventListener("click", async () => {
  const btn = $("register");
  try {
    btn.disabled = true;
    const registration = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: prefill.agentName + " (Sepolia validation test)",
      description: "Throwaway test agent for trying the ERC-8004 Validation Registry on Base Sepolia.",
      active: true,
      supportedTrust: ["validation"],
    };
    const uri = "data:application/json;base64," + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(registration))));
    status("registerStatus", "Sending transaction. Confirm in your wallet...");
    const hash = await walletClient.writeContract({
      address: prefill.identityRegistry, abi: identityAbi, functionName: "register", args: [uri], account,
    });
    status("registerStatus", "Transaction sent: " + hash + ". Waiting for confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    let agentId = null;
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi: identityAbi, data: log.data, topics: log.topics });
        if (ev.eventName === "Registered") { agentId = ev.args.agentId; break; }
      } catch {}
    }
    if (agentId !== null) {
      $("agentId").value = agentId.toString();
      status("registerStatus", "Registered! agentId = " + agentId + ". View: https://sepolia.basescan.org/tx/" + hash, "ok");
    } else {
      status("registerStatus", "Confirmed, but could not decode the agentId. Check: https://sepolia.basescan.org/tx/" + hash, "ok");
    }
  } catch (e) {
    status("registerStatus", e.shortMessage || e.message || String(e), "err");
  } finally {
    btn.disabled = false;
  }
});

$("request").addEventListener("click", async () => {
  const btn = $("request");
  try {
    if ($("agentId").value === "") { status("requestStatus", "Enter the agentId first (run step 0).", "err"); return; }
    btn.disabled = true;
    const requestHash = keccak256(stringToHex($("requestURI").value));
    status("requestStatus", "Sending transaction. Confirm in your wallet...");
    const hash = await walletClient.writeContract({
      address: prefill.validationRegistry, abi: validationAbi, functionName: "validationRequest",
      args: [$("validator").value, BigInt($("agentId").value), $("requestURI").value, requestHash],
      account,
    });
    status("requestStatus", "Transaction sent: " + hash + ". Waiting for confirmation...");
    await publicClient.waitForTransactionReceipt({ hash });
    $("respondHash").value = requestHash;
    status("requestStatus", "Validation requested! requestHash = " + requestHash + ". View: https://sepolia.basescan.org/tx/" + hash, "ok");
  } catch (e) {
    status("requestStatus", e.shortMessage || e.message || String(e), "err");
  } finally {
    btn.disabled = false;
  }
});

$("respond").addEventListener("click", async () => {
  const btn = $("respond");
  try {
    if (!$("respondHash").value) { status("respondStatus", "Enter the requestHash first (run step 1).", "err"); return; }
    btn.disabled = true;
    const responseURI = $("responseURI").value.trim();
    const responseHash = responseURI ? keccak256(stringToHex(responseURI)) : ZERO_HASH;
    status("respondStatus", "Sending transaction. Confirm in your wallet...");
    const hash = await walletClient.writeContract({
      address: prefill.validationRegistry, abi: validationAbi, functionName: "validationResponse",
      args: [$("respondHash").value, Number($("response").value), responseURI, responseHash, $("tag").value],
      account,
    });
    status("respondStatus", "Transaction sent: " + hash + ". Waiting for confirmation...");
    await publicClient.waitForTransactionReceipt({ hash });
    status("respondStatus", "Response recorded! View: https://sepolia.basescan.org/tx/" + hash, "ok");
  } catch (e) {
    status("respondStatus", e.shortMessage || e.message || String(e), "err");
  } finally {
    btn.disabled = false;
  }
});

async function read(fn, args) {
  status("readStatusMsg", "Reading...");
  const result = await publicClient.readContract({
    address: prefill.validationRegistry, abi: validationAbi, functionName: fn, args,
  });
  $("readOut").textContent = json(result);
  status("readStatusMsg", fn + " done.", "ok");
}

$("readStatus").addEventListener("click", async () => {
  try {
    if (!$("respondHash").value) { status("readStatusMsg", "Enter a requestHash in step 2 first.", "err"); return; }
    await read("getValidationStatus", [$("respondHash").value]);
  } catch (e) { status("readStatusMsg", e.shortMessage || e.message || String(e), "err"); }
});
$("readSummary").addEventListener("click", async () => {
  try {
    if ($("agentId").value === "") { status("readStatusMsg", "Enter an agentId first.", "err"); return; }
    await read("getSummary", [BigInt($("agentId").value), $("validator").value ? [$("validator").value] : [], $("tag").value]);
  } catch (e) { status("readStatusMsg", e.shortMessage || e.message || String(e), "err"); }
});
$("readList").addEventListener("click", async () => {
  try {
    if ($("agentId").value === "") { status("readStatusMsg", "Enter an agentId first.", "err"); return; }
    await read("getAgentValidations", [BigInt($("agentId").value)]);
  } catch (e) { status("readStatusMsg", e.shortMessage || e.message || String(e), "err"); }
});
</script>
</body>
</html>`;
}
