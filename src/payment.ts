import type { NextFunction, Request, Response } from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import type { AppConfig } from "./config.js";

export function createPaymentMiddleware(config: AppConfig) {
  const routeConfig = {
    "GET /secret": {
      accepts: {
        scheme: "exact" as const,
        price: config.x402Price,
        network: config.x402Network,
        payTo: config.x402PayTo,
      },
      description: "Access to the Banana Secret Agent paid secret",
    },
  };

  if (config.x402Mock) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || req.path !== "/secret") return next();
      const paymentHeader = req.header("X-PAYMENT") ?? req.header("payment-signature");
      if (paymentHeader) return next();

      return res.status(402).json({
        error: "x402 payment required",
        accepts: routeConfig["GET /secret"].accepts,
        resource: `${config.publicBaseUrl}/secret`,
        description: routeConfig["GET /secret"].description,
      });
    };
  }

  const facilitatorClient = new HTTPFacilitatorClient({ url: config.x402FacilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    config.x402Network,
    new ExactEvmScheme(),
  );

  const paywall = createPaywall()
    .withNetwork(evmPaywall)
    .withConfig({ appName: config.agentName })
    .build();

  return paymentMiddleware(
    routeConfig,
    resourceServer,
    {
      appName: config.agentName,
      testnet: config.x402Network !== "eip155:8453",
    },
    paywall,
  );
}
