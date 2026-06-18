// Load .env.local so tests can reach the Supabase project. Vitest runs this
// before the test suites (see vitest.config.ts setupFiles).
import { config } from "dotenv";

config({ path: ".env.local" });
