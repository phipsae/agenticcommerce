import type { AppConfig } from "./config.js";

// Browser playground for an ERC-8183 ("Agentic Commerce") job escrow on Base
// Sepolia. ERC-8183 has no canonical deployment, so this targets our own
// trimmed, spec-faithful escrow plus a mock USDC faucet token, both deployed
// to chain 84532 while the rest of the app stays on mainnet.
//
// A Job is all-or-nothing (one budget, one terminal complete/reject/expire),
// so "release some, do more work, release more" is modeled as several jobs in
// canonical order, one per milestone. One wallet plays all three roles
// (client, provider, evaluator); the evaluator is framed as the ERC-8004
// validator, which is what ties escrow release to on-chain validation.
export function escrowPage(config: AppConfig): string {
  const prefill = {
    escrow: config.escrow8183Address,
    token: config.escrowTokenAddress,
    chainId: 84532,
    milestones: [
      { description: "Deliver the banana secret (hash of the secret)", budget: "0.5" },
      { description: "Provide a follow-up sourcing report", budget: "0.5" },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Escrow playground (ERC-8183, Base Sepolia)</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, sans-serif; background: #f6f8fa; margin: 0; padding: 2rem 1rem; }
  main { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  h1 { font-size: 1.4rem; margin-top: 0; }
  h2 { font-size: 1.05rem; margin: 1.8rem 0 .4rem; border-top: 1px solid #d8dee4; padding-top: 1.2rem; }
  label { display: block; font-size: .85rem; font-weight: 600; margin: .9rem 0 .25rem; }
  input { width: 100%; box-sizing: border-box; padding: .5rem .6rem; border: 1px solid #d0d7de; border-radius: 6px; font-size: .9rem; font-family: inherit; }
  button { margin-top: 1rem; margin-right: .5rem; padding: .6rem 1.2rem; font-size: .95rem; border: 0; border-radius: 8px; background: #3b5bf6; color: #fff; cursor: pointer; }
  button.secondary { background: #6e7781; }
  button:disabled { background: #9aa7b1; cursor: not-allowed; }
  pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: .8rem; font-size: .75rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
  .status { margin-top: 1rem; font-size: .9rem; }
  .ok { color: #1a7f37; } .err { color: #cf222e; }
  .hint { font-size: .78rem; color: #57606a; margin-top: .2rem; }
  .card { border: 1px solid #d8dee4; border-radius: 10px; padding: 1.1rem 1.2rem; margin-top: 1.2rem; }
  .card h3 { font-size: 1rem; margin: 0 0 .2rem; }
  .pill { display: inline-block; font-size: .72rem; font-weight: 600; padding: .15rem .5rem; border-radius: 999px; background: #eaeef2; color: #57606a; margin-left: .4rem; }
  .tally { font-size: .95rem; font-weight: 600; margin-top: .6rem; }
</style>
</head>
<body>
<main>
  <h1>ERC-8183 escrow playground (Base Sepolia)</h1>
  <p>ERC-8183 ("Agentic Commerce") locks a job's budget in escrow until an <strong>evaluator</strong> approves the work (release to provider) or rejects it (refund to client). Here the evaluator is the <strong>ERC-8004 validator</strong>, so payment is released exactly when the work is validated.</p>
  <p class="hint">A Job is all-or-nothing, so milestones are modeled as several jobs in canonical order. One wallet plays client, provider, and evaluator. You need Base Sepolia ETH (<a href="https://portal.cdp.coinbase.com/products/faucet" target="_blank" rel="noopener">faucet</a>); mint the test token below for the budget.</p>

  <button id="connect">Connect wallet</button>
  <div class="status" id="connectStatus"></div>

  <h2>Step 1: Get test funds</h2>
  <p class="hint">Mints 100 test USDC to your wallet so you can fund the escrow. Escrow: <code>${config.escrow8183Address}</code> &nbsp; Token: <code>${config.escrowTokenAddress}</code></p>
  <button id="mint" disabled>Mint 100 test USDC</button>
  <div class="status" id="mintStatus"></div>

  <h2>Step 2: Run the milestones</h2>
  <p class="hint">Each milestone is its own job: create &rarr; set budget + approve + fund &rarr; submit deliverable &rarr; approve as the ERC-8004 validator (release) or reject (refund).</p>
  <div id="milestones"></div>
  <div class="tally" id="tally"></div>
</main>

<script type="module">
import { createWalletClient, createPublicClient, custom, keccak256, stringToHex, decodeEventLog, parseUnits, formatUnits } from "https://esm.sh/viem@2";
import { baseSepolia } from "https://esm.sh/viem@2/chains";

const prefill = ${JSON.stringify(prefill)};

const erc20Abi = [
  { type: "function", name: "mint", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];
// Canonical ERC-8183 surface: budget is set in its own step (not in createJob),
// createJob takes an optional hook address, fund carries an expectedBudget
// front-run guard, and submit/complete/reject all take a trailing optParams
// bytes plus an attestation reason on complete/reject.
const escrowAbi = [
  { type: "function", name: "createJob", stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ], outputs: [{ name: "jobId", type: "uint256" }] },
  { type: "function", name: "setBudget", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "amount", type: "uint256" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { type: "function", name: "fund", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "expectedBudget", type: "uint256" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { type: "function", name: "submit", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "deliverable", type: "bytes32" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { type: "function", name: "complete", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "reason", type: "bytes32" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { type: "function", name: "reject", stateMutability: "nonpayable",
    inputs: [{ name: "jobId", type: "uint256" }, { name: "reason", type: "bytes32" }, { name: "optParams", type: "bytes" }], outputs: [] },
  { type: "function", name: "getJob", stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [{ type: "tuple", components: [
      { name: "id", type: "uint256" },
      { name: "client", type: "address" },
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "description", type: "string" },
      { name: "budget", type: "uint256" },
      { name: "expiredAt", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "hook", type: "address" },
    ] }] },
  { type: "event", name: "JobCreated", inputs: [
    { name: "jobId", type: "uint256", indexed: true },
    { name: "client", type: "address", indexed: true },
    { name: "provider", type: "address", indexed: true },
    { name: "evaluator", type: "address", indexed: false },
    { name: "expiredAt", type: "uint256", indexed: false },
    { name: "hook", type: "address", indexed: false },
  ] },
];

const STATUS = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];
const $ = (id) => document.getElementById(id);
const ZERO_HASH = "0x" + "0".repeat(64);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const NO_PARAMS = "0x"; // optParams: no hook data in this demo
const status = (id, msg, cls = "") => { $(id).textContent = msg; $(id).className = "status " + cls; };
const errMsg = (e) => e.details || e.shortMessage || e.message || String(e);
const tx = (h) => "https://sepolia.basescan.org/tx/" + h;

let account = null;
let walletClient = null;
let publicClient = null;
let decimals = 6;
const jobs = {}; // milestone index -> { jobId, budget(bigint), status }

// Make sure the wallet is on Base Sepolia. Called on connect and before every
// transaction (wallets can silently stay on another chain, which makes
// eth_sendTransaction fail with -32602 invalid params).
async function ensureSepolia() {
  const current = await walletClient.getChainId();
  if (current === baseSepolia.id) return;
  try {
    await walletClient.switchChain({ id: baseSepolia.id });
  } catch (e) {
    if (e.code === 4001 || e.cause?.code === 4001) throw e;
    await walletClient.addChain({ chain: baseSepolia });
    await walletClient.switchChain({ id: baseSepolia.id });
  }
}

async function send(fn) {
  await ensureSepolia();
  const hash = await fn();
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

function renderTally() {
  let released = 0n, escrowed = 0n;
  for (const j of Object.values(jobs)) {
    if (j.status === 3) released += j.budget;        // Completed
    else if (j.status === 1 || j.status === 2) escrowed += j.budget; // Funded/Submitted
  }
  $("tally").textContent = "Released to provider: " + formatUnits(released, decimals) +
    " USDC  |  Still in escrow: " + formatUnits(escrowed, decimals) + " USDC";
}

function buildMilestone(i, m) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    '<h3>Milestone ' + (i + 1) + '<span class="pill" id="pill' + i + '">no job</span></h3>' +
    '<p class="hint">' + m.description + '</p>' +
    '<label>Budget (test USDC)</label>' +
    '<input id="budget' + i + '" value="' + m.budget + '">' +
    '<label>Deliverable text (hashed on submit)</label>' +
    '<input id="deliverable' + i + '" value="' + m.description + '">' +
    '<div>' +
      '<button id="create' + i + '" disabled>1. Create job</button>' +
      '<button id="fund' + i + '" disabled>2. Set budget, approve + fund</button>' +
      '<button id="submit' + i + '" disabled>3. Submit deliverable</button>' +
      '<button id="complete' + i + '" disabled>4. Approve as ERC-8004 validator</button>' +
      '<button id="reject' + i + '" class="secondary" disabled>Reject (refund)</button>' +
    '</div>' +
    '<div class="status" id="status' + i + '"></div>';
  $("milestones").appendChild(card);

  const sid = "status" + i;
  const setPill = (s) => { $("pill" + i).textContent = STATUS[s]; };
  const budgetWei = () => parseUnits($("budget" + i).value || "0", decimals);

  $("create" + i).addEventListener("click", async () => {
    try {
      $("create" + i).disabled = true;
      status(sid, "Creating job. Confirm in your wallet...");
      const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 86400);
      const budget = budgetWei();
      const hash = await send(() => walletClient.writeContract({
        address: prefill.escrow, abi: escrowAbi, functionName: "createJob",
        args: [account, account, expiredAt, $("deliverable" + i).value, ZERO_ADDRESS], account,
      }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let jobId = null;
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics });
          if (ev.eventName === "JobCreated") { jobId = ev.args.jobId; break; }
        } catch {}
      }
      jobs[i] = { jobId, budget, status: 0 };
      setPill(0);
      $("fund" + i).disabled = false;
      $("reject" + i).disabled = false;
      status(sid, "Job created (id " + jobId + "). View: " + tx(hash), "ok");
    } catch (e) { status(sid, errMsg(e), "err"); $("create" + i).disabled = false; }
  });

  $("fund" + i).addEventListener("click", async () => {
    try {
      $("fund" + i).disabled = true;
      const budget = jobs[i].budget;
      status(sid, "Setting budget (1/3). Confirm in your wallet...");
      await send(() => walletClient.writeContract({
        address: prefill.escrow, abi: escrowAbi, functionName: "setBudget",
        args: [jobs[i].jobId, budget, NO_PARAMS], account,
      }));
      status(sid, "Approving token (2/3). Confirm in your wallet...");
      await send(() => walletClient.writeContract({
        address: prefill.token, abi: erc20Abi, functionName: "approve",
        args: [prefill.escrow, budget], account,
      }));
      // expectedBudget guards against the budget changing between read and call.
      status(sid, "Funding escrow (3/3). Confirm in your wallet...");
      const hash = await send(() => walletClient.writeContract({
        address: prefill.escrow, abi: escrowAbi, functionName: "fund",
        args: [jobs[i].jobId, budget, NO_PARAMS], account,
      }));
      jobs[i].status = 1; setPill(1); renderTally();
      $("submit" + i).disabled = false;
      status(sid, "Funded. Budget locked in escrow. View: " + tx(hash), "ok");
    } catch (e) { status(sid, errMsg(e), "err"); $("fund" + i).disabled = false; }
  });

  $("submit" + i).addEventListener("click", async () => {
    try {
      $("submit" + i).disabled = true;
      const deliverable = keccak256(stringToHex($("deliverable" + i).value));
      status(sid, "Submitting deliverable. Confirm in your wallet...");
      const hash = await send(() => walletClient.writeContract({
        address: prefill.escrow, abi: escrowAbi, functionName: "submit",
        args: [jobs[i].jobId, deliverable, NO_PARAMS], account,
      }));
      jobs[i].status = 2; setPill(2); renderTally();
      $("complete" + i).disabled = false;
      status(sid, "Deliverable submitted (hash " + deliverable.slice(0, 18) + "...). View: " + tx(hash), "ok");
    } catch (e) { status(sid, errMsg(e), "err"); $("submit" + i).disabled = false; }
  });

  $("complete" + i).addEventListener("click", async () => {
    try {
      $("complete" + i).disabled = true;
      status(sid, "Validator approving. Funds release to provider. Confirm in your wallet...");
      // reason is the evaluator's on-chain attestation; here it stands in for an
      // ERC-8004 validation reference tying release to a passing validation.
      const reason = keccak256(stringToHex("erc8004-validated"));
      const hash = await send(() => walletClient.writeContract({
        address: prefill.escrow, abi: escrowAbi, functionName: "complete",
        args: [jobs[i].jobId, reason, NO_PARAMS], account,
      }));
      jobs[i].status = 3; setPill(3); renderTally();
      $("reject" + i).disabled = true;
      status(sid, "Completed. Budget released to provider. View: " + tx(hash), "ok");
    } catch (e) { status(sid, errMsg(e), "err"); $("complete" + i).disabled = false; }
  });

  $("reject" + i).addEventListener("click", async () => {
    try {
      $("reject" + i).disabled = true;
      status(sid, "Rejecting. Funds refund to client. Confirm in your wallet...");
      const hash = await send(() => walletClient.writeContract({
        address: prefill.escrow, abi: escrowAbi, functionName: "reject",
        args: [jobs[i].jobId, ZERO_HASH, NO_PARAMS], account,
      }));
      jobs[i].status = 4; setPill(4); renderTally();
      $("complete" + i).disabled = true;
      status(sid, "Rejected. Budget refunded to client. View: " + tx(hash), "ok");
    } catch (e) { status(sid, errMsg(e), "err"); $("reject" + i).disabled = false; }
  });
}

prefill.milestones.forEach((m, i) => buildMilestone(i, m));
renderTally();

$("connect").addEventListener("click", async () => {
  try {
    if (!window.ethereum) { status("connectStatus", "No browser wallet found. Install MetaMask or Rabby.", "err"); return; }
    walletClient = createWalletClient({ chain: baseSepolia, transport: custom(window.ethereum) });
    [account] = await walletClient.requestAddresses();
    await ensureSepolia();
    publicClient = createPublicClient({ chain: baseSepolia, transport: custom(window.ethereum) });
    try { decimals = await publicClient.readContract({ address: prefill.token, abi: erc20Abi, functionName: "decimals" }); } catch {}
    $("mint").disabled = false;
    prefill.milestones.forEach((_, i) => { $("create" + i).disabled = false; });
    $("connect").disabled = true;
    status("connectStatus", "Connected: " + account + " (Base Sepolia).", "ok");
  } catch (e) {
    status("connectStatus", errMsg(e), "err");
  }
});

$("mint").addEventListener("click", async () => {
  try {
    $("mint").disabled = true;
    status("mintStatus", "Minting. Confirm in your wallet...");
    const hash = await send(() => walletClient.writeContract({
      address: prefill.token, abi: erc20Abi, functionName: "mint",
      args: [account, parseUnits("100", decimals)], account,
    }));
    const bal = await publicClient.readContract({ address: prefill.token, abi: erc20Abi, functionName: "balanceOf", args: [account] });
    status("mintStatus", "Minted. Balance: " + formatUnits(bal, decimals) + " test USDC. View: " + tx(hash), "ok");
  } catch (e) { status("mintStatus", errMsg(e), "err"); } finally { $("mint").disabled = false; }
});
</script>
</body>
</html>`;
}
