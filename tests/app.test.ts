import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { SECRET, secretHash } from "../src/secret.js";

describe("banana paid secret MVP", () => {
  const app = createApp({
    publicBaseUrl: "https://banana.example",
    x402Mock: true,
    x402Network: "eip155:8453",
    x402Price: "$0.01",
    x402PayTo: "0x1111111111111111111111111111111111111111",
    x402FacilitatorUrl: "https://facilitator.x402.org",
    agentName: "Banana Secret Agent",
    agentDescription: "Returns a banana secret after x402 payment.",
    agentImageUrl: "https://banana.example/banana.png",
    erc8004ChainId: 8453,
    erc8004IdentityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    erc8004ReputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  });

  it("returns x402-style HTTP 402 payment requirements when unpaid", async () => {
    const res = await request(app).get("/secret").expect(402);

    expect(res.body).toMatchObject({
      error: "x402 payment required",
      accepts: {
        scheme: "exact",
        price: "$0.01",
        network: "eip155:8453",
        payTo: "0x1111111111111111111111111111111111111111",
      },
      resource: "https://banana.example/secret",
    });
  });

  it("returns the banana secret when a mock payment header is present", async () => {
    const res = await request(app)
      .get("/secret")
      .set("X-PAYMENT", "local-dev-paid")
      .expect(200);

    expect(res.body).toEqual({
      secret: SECRET,
      secretHash,
      payment: {
        protocol: "x402",
        network: "eip155:8453",
        amount: "$0.01",
      },
    });
  });

  it("serves an ERC-8004 registration file with x402 and trust metadata", async () => {
    const res = await request(app).get("/.well-known/agent-registration.json").expect(200);

    expect(res.body).toMatchObject({
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: "Banana Secret Agent",
      x402Support: true,
      active: true,
      supportedTrust: ["reputation", "validation"],
    });
    // Best practice: pricing as text in the description, payTo as agentWallet service.
    expect(res.body.description).toContain("$0.01");
    expect(res.body.services).toContainEqual({
      name: "web",
      endpoint: "https://banana.example/secret",
      version: "x402-v2",
    });
    expect(res.body.services).toContainEqual({
      name: "agentWallet",
      endpoint: "eip155:8453:0x1111111111111111111111111111111111111111",
    });
    expect(res.body.payments).toBeUndefined();
    expect(res.body.registrations).toContainEqual({
      agentRegistry: "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      agentId: null,
    });
  });

  it("serves validation evidence for ERC-8004 validator responses", async () => {
    const res = await request(app).get("/validation/banana-secret.json").expect(200);

    expect(res.body).toMatchObject({
      tag: "x402-paid-secret-delivery",
      expectedSecretHash: secretHash,
      checks: [
        "unpaid request returns HTTP 402",
        "payment requirement advertises x402 exact payment",
        "paid request returns expected secret",
        "response hash matches expected secret hash",
      ],
      recommendedScoreIfPassing: 100,
    });
  });

  it("serves the on-chain registration page with prefilled values", async () => {
    const res = await request(app).get("/register").expect(200);

    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
    expect(res.text).toContain("https://banana.example/secret");
    expect(res.text).toContain("0x1111111111111111111111111111111111111111");
    expect(res.text).toContain("data:application/json;base64");
  });

  it("serves the review page with prefilled values", async () => {
    const res = await request(app).get("/review").expect(200);

    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63");
    expect(res.text).toContain("https://banana.example/secret");
    expect(res.text).toContain("x402-paid-secret-delivery");
    expect(res.text).toContain("giveFeedback");
  });

  it("has a health endpoint", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ ok: true, service: "banana-secret-agent" });
  });
});
