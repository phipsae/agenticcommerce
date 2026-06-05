import express from "express";
import type { AppConfig } from "./config.js";
import { agentRegistration, validationEvidence } from "./metadata.js";
import { createPaymentMiddleware } from "./payment.js";
import { SECRET, secretHash } from "./secret.js";

export function createApp(config: AppConfig) {
  const app = express();

  // Behind Vercel's proxy: respect X-Forwarded-Proto so req.protocol is https.
  // Without this the x402 middleware advertises an http:// resource URL,
  // which browsers block as mixed content.
  app.set("trust proxy", true);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "banana-secret-agent" });
  });

  app.get("/.well-known/agent-registration.json", (_req, res) => {
    res.json(agentRegistration(config));
  });

  app.get("/validation/banana-secret.json", (_req, res) => {
    res.json(validationEvidence(config));
  });

  app.use(createPaymentMiddleware(config));

  app.get("/secret", (_req, res) => {
    res.json({
      secret: SECRET,
      secretHash,
      payment: {
        protocol: "x402",
        network: config.x402Network,
        amount: config.x402Price,
      },
    });
  });

  return app;
}
