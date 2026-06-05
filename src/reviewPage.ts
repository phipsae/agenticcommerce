import type { AppConfig } from "./config.js";

// Browser page for submitting ERC-8004 reputation feedback (a review).
// The comment + score are packed into a base64 data: URI whose keccak hash
// is anchored on-chain as feedbackHash; any wallet can review.
export function reviewPage(config: AppConfig): string {
  const prefill = {
    reputationRegistry: config.erc8004ReputationRegistry ?? "",
    identityRegistry: config.erc8004IdentityRegistry ?? "",
    endpoint: `${config.publicBaseUrl}/secret`,
    tag1: "x402-paid-secret-delivery",
    tag2: "buyer-review",
    agentName: config.agentName,
    payTo: config.x402PayTo,
    chainId: config.erc8004ChainId,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review the agent (ERC-8004)</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, sans-serif; background: #f6f8fa; margin: 0; padding: 2rem 1rem; }
  main { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { font-size: 1.4rem; margin-top: 0; }
  label { display: block; font-size: .85rem; font-weight: 600; margin: .9rem 0 .25rem; }
  input, textarea { width: 100%; box-sizing: border-box; padding: .5rem .6rem; border: 1px solid #d0d7de; border-radius: 6px; font-size: .9rem; font-family: inherit; }
  textarea { resize: vertical; }
  button { margin-top: 1.2rem; padding: .6rem 1.2rem; font-size: 1rem; border: 0; border-radius: 8px; background: #3b5bf6; color: #fff; cursor: pointer; }
  button:disabled { background: #9aa7b1; cursor: not-allowed; }
  pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: .8rem; font-size: .75rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
  .status { margin-top: 1rem; font-size: .9rem; }
  .ok { color: #1a7f37; } .err { color: #cf222e; }
  .hint { font-size: .78rem; color: #57606a; margin-top: .2rem; }
</style>
</head>
<body>
<main>
  <h1>Review ${config.agentName} (ERC-8004 reputation)</h1>
  <p>Submits <code>giveFeedback</code> to the Reputation Registry on Base. Your review is signed by your wallet and publicly attributable to it.</p>

  <label>Agent ID</label>
  <input id="agentId" type="number" min="0" placeholder="the agentId from registration">
  <div class="hint">The token ID minted when the agent was registered on the Identity Registry.</div>
  <label>Score (0-100)</label>
  <input id="value" type="number" min="0" max="100" value="100">
  <label>Tag 1</label>
  <input id="tag1">
  <label>Tag 2</label>
  <input id="tag2">
  <label>Endpoint reviewed</label>
  <input id="endpoint">
  <label>Comment (stored fully on-chain in the feedback URI)</label>
  <textarea id="comment" rows="3" placeholder="Paid and received the secret."></textarea>
  <label>Payment tx hash (optional, proof you actually paid)</label>
  <input id="paymentTx" placeholder="0x... the USDC settlement tx of your x402 payment">
  <div class="hint">Adds a proofOfPayment block so verifiers can check this wallet really paid the agent before reviewing.</div>
  <label>Reputation Registry contract</label>
  <input id="registry">
  <div class="hint">Canonical ERC-8004 Reputation Registry on Base mainnet.</div>

  <label>Resulting feedback JSON</label>
  <pre id="preview"></pre>

  <button id="action">Connect wallet</button>
  <div class="status" id="status"></div>
</main>

<script type="module">
import { createWalletClient, createPublicClient, custom, keccak256, stringToHex } from "https://esm.sh/viem@2";
import { base } from "https://esm.sh/viem@2/chains";

const prefill = ${JSON.stringify(prefill)};
const abi = [
  { type: "function", name: "giveFeedback", stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ], outputs: [] },
];

const $ = (id) => document.getElementById(id);
$("tag1").value = prefill.tag1;
$("tag2").value = prefill.tag2;
$("endpoint").value = prefill.endpoint;
$("registry").value = prefill.reputationRegistry;

function feedbackJson() {
  // Off-chain feedback file per the EIP-8004 spec example: spec-named core
  // fields, proofOfPayment top-level ("this can be used for x402 proof of payment").
  const feedback = {
    agentRegistry: "eip155:" + prefill.chainId + ":" + prefill.identityRegistry,
    agentId: Number($("agentId").value || 0),
    clientAddress: "eip155:" + prefill.chainId + ":" + (account ?? "<connect wallet>"),
    createdAt: new Date().toISOString(),
    value: Number($("value").value),
    valueDecimals: 0,
    tag1: $("tag1").value,
    tag2: $("tag2").value,
    endpoint: $("endpoint").value,
    comment: $("comment").value,
  };
  if ($("paymentTx").value.trim()) {
    feedback.proofOfPayment = {
      fromAddress: account ?? "<connect wallet>",
      toAddress: prefill.payTo,
      chainId: String(prefill.chainId),
      txHash: $("paymentTx").value.trim(),
    };
  }
  return JSON.stringify(feedback);
}

function feedbackUri() {
  return "data:application/json;base64," + btoa(String.fromCharCode(...new TextEncoder().encode(feedbackJson())));
}

function refresh() {
  $("preview").textContent = JSON.stringify(JSON.parse(feedbackJson()), null, 2);
}
document.querySelectorAll("input, textarea").forEach((el) => el.addEventListener("input", refresh));
refresh();

const status = (msg, cls = "") => { $("status").textContent = msg; $("status").className = "status " + cls; };

let account = null;
let walletClient = null;

$("action").addEventListener("click", async () => {
  const btn = $("action");
  try {
    if (!window.ethereum) { status("No browser wallet found. Install MetaMask or Rabby.", "err"); return; }
    btn.disabled = true;

    if (!account) {
      walletClient = createWalletClient({ chain: base, transport: custom(window.ethereum) });
      [account] = await walletClient.requestAddresses();
      await walletClient.switchChain({ id: base.id }).catch(async (e) => {
        if (e.code === 4902) await walletClient.addChain({ chain: base }); else throw e;
      });
      btn.textContent = "Submit review on-chain";
      status("Connected: " + account + " (Base).", "ok");
      refresh();
      btn.disabled = false;
      return;
    }

    if ($("agentId").value === "") { status("Enter the agentId first.", "err"); btn.disabled = false; return; }

    status("Sending transaction. Confirm in your wallet...");
    const uri = feedbackUri();
    const hash = await walletClient.writeContract({
      address: $("registry").value,
      abi,
      functionName: "giveFeedback",
      args: [
        BigInt($("agentId").value),
        BigInt($("value").value),
        0,
        $("tag1").value,
        $("tag2").value,
        $("endpoint").value,
        uri,
        keccak256(stringToHex(uri)),
      ],
      account,
    });
    status("Transaction sent: " + hash + ". Waiting for confirmation...");

    const publicClient = createPublicClient({ chain: base, transport: custom(window.ethereum) });
    await publicClient.waitForTransactionReceipt({ hash });
    status("Review submitted! View: https://basescan.org/tx/" + hash, "ok");
  } catch (e) {
    status(e.shortMessage || e.message || String(e), "err");
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;
}
