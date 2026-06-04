import "dotenv/config";
import { createApp } from "./app.js";
import { configFromEnv } from "./config.js";

const config = configFromEnv();
const port = Number(process.env.PORT ?? 3000);

const app = createApp(config);

app.listen(port, () => {
  console.log(`Banana Secret Agent listening on http://localhost:${port}`);
  console.log(`Registration file: ${config.publicBaseUrl}/.well-known/agent-registration.json`);
  console.log(`Secret endpoint: ${config.publicBaseUrl}/secret`);
  console.log(`x402 mode: ${config.x402Mock ? "mock/local" : "real"}`);
});
