import { createHash } from "node:crypto";

export const SECRET = "the best bananas are from ecuador";

export const secretHash = `0x${createHash("sha256").update(SECRET).digest("hex")}`;
