import { betterAuth } from "better-auth";
import { pool } from "./db.js";

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.CLIENT_ORIGIN],
  emailAndPassword: {
    enabled: true,
  },
});
