import type { AppConfig } from "./config.js";

// Browser page for registering the agent on the ERC-8004 Identity Registry.
// The form values are packed into a base64 data: URI (registration-v1 JSON),
// so the whole registration lives on-chain in calldata: no hosted file.
export function registerPage(config: AppConfig): string {
  const identityRegistry = config.erc8004IdentityRegistry ?? "";
  const prefill = {
    name: config.agentName,
    description: config.agentDescription,
    image: config.agentImageUrl,
    endpoint: `${config.publicBaseUrl}/secret`,
    payTo: config.x402PayTo,
    price: config.x402Price,
    network: config.x402Network,
    facilitator: config.x402FacilitatorUrl,
    identityRegistry,
    chainId: config.erc8004ChainId,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Register on ERC-8004</title>
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
  <h1>Register agent on ERC-8004 (Base)</h1>
  <p>The values below are packed into a <code>data:application/json;base64</code> URI and stored fully on-chain via <code>register(agentURI)</code>. Updating them later requires a new transaction (<code>setAgentURI</code>).</p>

  <label>Agent name</label>
  <input id="name">
  <label>Description</label>
  <textarea id="description" rows="2"></textarea>
  <label>Image URL</label>
  <input id="image">
  <label>Service endpoint (the paid x402 endpoint)</label>
  <input id="endpoint">
  <label>payTo (wallet receiving x402 payments)</label>
  <input id="payTo">
  <label>Price</label>
  <input id="price">
  <label>Identity Registry contract</label>
  <input id="registry">
  <div class="hint">Canonical ERC-8004 Identity Registry on Base mainnet.</div>

  <label>Resulting on-chain JSON (registration-v1)</label>
  <pre id="preview"></pre>
  <div class="hint"><span id="bytes"></span> bytes of calldata. Bigger JSON = more gas.</div>

  <button id="action">Connect wallet</button>
  <div class="status" id="status"></div>
</main>

<script type="module">
import { createWalletClient, createPublicClient, custom, decodeEventLog } from "https://esm.sh/viem@2";
import { base } from "https://esm.sh/viem@2/chains";

const prefill = ${JSON.stringify(prefill)};
const abi = [
  { type: "function", name: "register", stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] },
  { type: "event", name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ] },
];

const $ = (id) => document.getElementById(id);
for (const k of ["name", "description", "image", "endpoint", "payTo", "price"]) $(k).value = prefill[k];
$("registry").value = prefill.identityRegistry;

function buildJson() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: $("name").value,
    description: $("description").value,
    image: $("image").value,
    services: [{ name: "web", endpoint: $("endpoint").value, version: "x402-v2" }],
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
    payments: {
      protocol: "x402",
      scheme: "exact",
      network: prefill.network,
      price: $("price").value,
      payTo: $("payTo").value,
      facilitator: prefill.facilitator,
    },
  };
}

function dataUri() {
  const json = JSON.stringify(buildJson());
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return "data:application/json;base64," + b64;
}

function refresh() {
  $("preview").textContent = JSON.stringify(buildJson(), null, 2);
  $("bytes").textContent = dataUri().length;
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
      btn.textContent = "Register on-chain";
      status("Connected: " + account + " (Base). Review the JSON, then register.", "ok");
      btn.disabled = false;
      return;
    }

    status("Sending transaction. Confirm in your wallet...");
    const hash = await walletClient.writeContract({
      address: $("registry").value,
      abi,
      functionName: "register",
      args: [dataUri()],
      account,
    });
    status("Transaction sent: " + hash + ". Waiting for confirmation...");

    const publicClient = createPublicClient({ chain: base, transport: custom(window.ethereum) });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    let agentId = null;
    for (const log of receipt.logs) {
      try {
        const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
        if (ev.eventName === "Registered") { agentId = ev.args.agentId; break; }
      } catch {}
    }

    if (agentId !== null) {
      status("Registered! agentId = " + agentId + ". View: https://basescan.org/tx/" + hash, "ok");
    } else {
      status("Confirmed, but could not decode the agentId. Check the tx: https://basescan.org/tx/" + hash, "ok");
    }
  } catch (e) {
    status(e.shortMessage || e.message || String(e), "err");
    btn.disabled = false;
  }
});
</script>
</body>
</html>`;
}
