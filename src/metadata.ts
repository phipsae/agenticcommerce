import type { AppConfig } from "./config.js";
import { secretHash } from "./secret.js";

export function agentRegistration(config: AppConfig, agentId: number | null = null) {
  const services = [
    {
      name: "web",
      endpoint: `${config.publicBaseUrl}/secret`,
      version: "x402-v2",
    },
    {
      name: "metadata",
      endpoint: `${config.publicBaseUrl}/.well-known/agent-registration.json`,
      version: "erc-8004-registration-v1",
    },
  ];

  const registrations = config.erc8004IdentityRegistry
    ? [
        {
          agentId,
          agentRegistry: `eip155:${config.erc8004ChainId}:${config.erc8004IdentityRegistry}`,
        },
      ]
    : [];

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: config.agentName,
    description: config.agentDescription,
    image: config.agentImageUrl,
    services,
    x402Support: true,
    active: true,
    registrations,
    supportedTrust: ["reputation", "validation"],
    payments: {
      protocol: "x402",
      scheme: "exact",
      network: config.x402Network,
      price: config.x402Price,
      payTo: config.x402PayTo,
      facilitator: config.x402FacilitatorUrl,
    },
    bananaSecret: {
      responseField: "secret",
      expectedSha256: secretHash,
    },
  };
}

export function validationEvidence(config: AppConfig) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#validation-evidence-v1",
    tag: "x402-paid-secret-delivery",
    agentName: config.agentName,
    endpoint: `${config.publicBaseUrl}/secret`,
    payment: {
      protocol: "x402",
      scheme: "exact",
      network: config.x402Network,
      price: config.x402Price,
      payTo: config.x402PayTo,
    },
    expectedSecretHash: secretHash,
    checks: [
      "unpaid request returns HTTP 402",
      "payment requirement advertises x402 exact payment",
      "paid request returns expected secret",
      "response hash matches expected secret hash",
    ],
    recommendedScoreIfPassing: 100,
  };
}
