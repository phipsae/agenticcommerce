import type { AppConfig } from "./config.js";

// Overview / index page served at "/". Links every subpage of the Banana
// Secret Agent so the deployment is navigable from its root URL. Kept free
// (registered before the payment middleware) and styled to match the other
// playground pages.
export function homePage(config: AppConfig): string {
  const mainnet = config.x402Network === "eip155:8453";

  // Each card is one clickable destination. `tag` distinguishes interactive
  // HTML playgrounds from raw machine-readable JSON endpoints.
  const pages = [
    {
      href: "/secret",
      title: "Buy the secret",
      tag: "x402",
      desc: `The product. Pay ${config.x402Price} over x402 on ${
        mainnet ? "Base mainnet" : "a test network"
      } and the agent returns its secret. Opens the wallet paywall in a browser.`,
    },
    {
      href: "/register",
      title: "Register (ERC-8004)",
      tag: "playground",
      desc: "On-chain Identity Registry playground: register this agent and publish its registration file.",
    },
    {
      href: "/review",
      title: "Reputation feedback (ERC-8004)",
      tag: "playground",
      desc: "Leave on-chain feedback for the agent via the Reputation Registry's giveFeedback call.",
    },
    {
      href: "/validation",
      title: "Validation (ERC-8004)",
      tag: "Base Sepolia",
      desc: "Run the full validation flow against the Validation Registry: request a validation and record the response.",
    },
    {
      href: "/escrow",
      title: "Escrow (ERC-8183)",
      tag: "Base Sepolia",
      desc: "Lock a job budget in escrow and release it when the ERC-8004 validator approves the work.",
    },
  ];

  const endpoints = [
    { href: "/.well-known/agent-registration.json", label: "agent-registration.json" },
    { href: "/validation/banana-secret.json", label: "validation evidence" },
    { href: "/health", label: "health" },
  ];

  const cards = pages
    .map(
      (p) => `
    <a class="card" href="${p.href}">
      <div class="card-head"><h3>${p.title}</h3><span class="pill">${p.tag}</span></div>
      <p>${p.desc}</p>
      <span class="go">${p.href} &rarr;</span>
    </a>`,
    )
    .join("");

  const endpointLinks = endpoints
    .map((e) => `<li><a href="${e.href}"><code>${e.href}</code></a> &mdash; ${e.label}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${config.agentName}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, sans-serif; background: #f6f8fa; margin: 0; padding: 2.5rem 1rem; color: #1f2328; }
  main { max-width: 760px; margin: 0 auto; }
  header { margin-bottom: 1.5rem; }
  h1 { font-size: 1.6rem; margin: 0 0 .4rem; }
  .lead { font-size: .98rem; color: #57606a; margin: 0; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
  a.card { display: block; text-decoration: none; color: inherit; background: #fff; border: 1px solid #d8dee4; border-radius: 12px; padding: 1.2rem 1.3rem; box-shadow: 0 1px 4px rgba(0,0,0,.06); transition: border-color .15s, box-shadow .15s, transform .15s; }
  a.card:hover { border-color: #3b5bf6; box-shadow: 0 4px 14px rgba(59,91,246,.16); transform: translateY(-2px); }
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
  .card h3 { font-size: 1.05rem; margin: 0; }
  .card p { font-size: .88rem; color: #57606a; margin: .5rem 0 .9rem; line-height: 1.45; }
  .pill { flex: none; font-size: .7rem; font-weight: 600; padding: .15rem .55rem; border-radius: 999px; background: #eaeef2; color: #57606a; }
  .go { font-size: .82rem; font-weight: 600; color: #3b5bf6; font-family: ui-monospace, monospace; }
  section.endpoints { margin-top: 2rem; background: #fff; border: 1px solid #d8dee4; border-radius: 12px; padding: 1.2rem 1.3rem; }
  section.endpoints h2 { font-size: 1rem; margin: 0 0 .6rem; }
  section.endpoints ul { margin: 0; padding-left: 1.1rem; font-size: .88rem; color: #57606a; line-height: 1.8; }
  code { font-family: ui-monospace, monospace; font-size: .85em; }
  footer { margin-top: 2rem; font-size: .8rem; color: #8c959f; }
</style>
</head>
<body>
<main>
  <header>
    <h1>${config.agentName}</h1>
    <p class="lead">${config.agentDescription}</p>
  </header>
  <div class="grid">${cards}
  </div>
  <section class="endpoints">
    <h2>Machine-readable endpoints</h2>
    <ul>${endpointLinks}</ul>
  </section>
  <footer>x402 network ${config.x402Network} &middot; pay to <code>${config.x402PayTo}</code></footer>
</main>
</body>
</html>`;
}
