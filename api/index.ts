import "dotenv/config";
import { createApp } from "../src/app.js";
import { configFromEnv } from "../src/config.js";

const app = createApp(configFromEnv());

export default app;
