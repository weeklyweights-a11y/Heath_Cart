import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Vitest runs v1 regression by default; v2-smoke opts in via beforeAll
if (process.env.VITEST_V2_SUITE !== "1") {
  process.env.INTELLIGENCE_V2 = "false";
}
