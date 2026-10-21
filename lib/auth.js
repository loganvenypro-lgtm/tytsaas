import crypto from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { getDicebearAvatar, isAllowedAvatarUrl } from "./avatar.js";
import { pool } from "./db.js";

// Accounts imported from the old Outlr app keep their PBKDF2 hash, stored as
// "pbkdf2$<salt>:<hash>" by scripts/import-outlr.js.
const LEGACY_PREFIX = "pbkdf2$";

function verifyLegacyPassword(stored, password) {
  const [salt, key] = stored.slice(LEGACY_PREFIX.length).split(":");
  if (!salt || !key) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash.length === key.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(key));
}

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.CLIENT_ORIGIN],
  emailAndPassword: {
    enabled: true,
    password: {
      hash: hashPassword,
      verify: async ({ hash, password }) =>
        hash.startsWith(LEGACY_PREFIX)
          ? verifyLegacyPassword(hash, password)
          : verifyPassword({ hash, password }),
    },
  },
  user: {
    additionalFields: {
      plan: { type: "string", input: false, defaultValue: "Pro" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Every new account starts with its DiceBear avatar, seeded by email
        before: async (user) => ({ data: { ...user, image: getDicebearAvatar(user.email) } }),
      },
      update: {
        before: async (data) => {
          if (data.image != null && !isAllowedAvatarUrl(data.image)) {
            throw new APIError("BAD_REQUEST", { message: "Avatar non autorisé." });
          }
          return { data };
        },
      },
    },
  },
  plugins: [admin()],
});
