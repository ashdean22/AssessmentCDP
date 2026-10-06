/**
 * Prints a valid session cookie value for local curl testing:
 *   npx tsx scripts/dev-session.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSessionToken } from "@/lib/auth";

console.log(createSessionToken().token);
