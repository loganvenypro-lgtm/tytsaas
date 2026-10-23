import crypto from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, organization } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { getDicebearAvatar, isAllowedAvatarUrl } from "./avatar.js";
import { pool } from "./db.js";
import { createLimiter } from "./rateLimit.js";
import { joinDiscordGuild } from "./discord.js";
import {
  sendNewSignInEmail,
  sendPasswordChangedEmail,
  sendResetPasswordEmail,
  sendTeamInvitationEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "./emails.js";
import { postSignIn } from "./signInWebhook.js";

// Accounts imported from the old Outlr app keep their PBKDF2 hash, stored as
// "pbkdf2$<salt>:<hash>" by scripts/import-outlr.js.
const LEGACY_PREFIX = "pbkdf2$";

function verifyLegacyPassword(stored, password) {
  const [salt, key] = stored.slice(LEGACY_PREFIX.length).split(":");
  if (!salt || !key) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash.length === key.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(key));
}

const INVITATION_DAYS = 7;

// Per-email limits on top of Better Auth's per-IP ones: the client IP comes from
// x-forwarded-for, which a client can set itself unless a proxy in front rewrites it,
// while the email is what an attacker targets. Sign-in counts every attempt; the
// other routes send an email each time.
const EMAIL_LIMITS = {
  "/sign-in/email": createLimiter({ windowMs: 15 * 60_000, max: 10 }),
  "/sign-up/email": createLimiter({ windowMs: 60 * 60_000, max: 5 }),
  "/request-password-reset": createLimiter({ windowMs: 60 * 60_000, max: 3 }),
  "/send-verification-email": createLimiter({ windowMs: 60 * 60_000, max: 3 }),
};

const limitPerEmail = createAuthMiddleware(async (ctx) => {
  const limiter = EMAIL_LIMITS[ctx.path];
  const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
  if (!limiter || !email) return;
  const wait = limiter.hit(email);
  if (wait) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Trop de tentatives pour cette adresse, réessaie plus tard.",
      code: "TOO_MANY_REQUESTS",
    });
  }
});

async function joinOnDiscordSignIn(account) {
  if (account?.providerId === "discord") await joinDiscordGuild(account.accountId, account.accessToken);
}

// A sign-up signs the user in right away: that first session gets the welcome email, not an alert
const FRESH_ACCOUNT_MS = 2 * 60 * 1000;

async function alertOnSignIn(session, ctx) {
  // The session opened by the email-verification link is the end of the sign-up, not a new sign-in
  if (session.impersonatedBy || ctx?.path === "/verify-email") return;
  const { rows } = await pool.query('SELECT name, email, "createdAt" FROM "user" WHERE id = $1', [session.userId]);
  const user = rows[0];
  if (!user || Date.now() - new Date(user.createdAt).getTime() < FRESH_ACCOUNT_MS) return;
  sendNewSignInEmail(user, { userAgent: session.userAgent, ipAddress: session.ipAddress, at: new Date(session.createdAt ?? Date.now()) });
}

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.CLIENT_ORIGIN],
  // On in every environment (Better Auth only turns it on when NODE_ENV=production).
  // Sign-in, sign-up and password routes get Better Auth's stricter default rules.
  rateLimit: { enabled: true, window: 60, max: 100 },
  advanced: {
    ipAddress: {
      // Behind Cloudflare: CLIENT_IP_HEADER=cf-connecting-ip. Otherwise the proxy in
      // front of Next must overwrite x-forwarded-for (Next keeps the client's own).
      ipAddressHeaders: process.env.CLIENT_IP_HEADER ? [process.env.CLIENT_IP_HEADER] : undefined,
    },
  },
  hooks: { before: limitPerEmail },
  // Its answer carries every session's token to the browser, where a script could read
  // them all: the settings list goes through /api/account/sessions instead (ids only)
  disabledPaths: ["/list-sessions"],
  emailAndPassword: {
    enabled: true,
    // An unverified address could belong to someone else: no session (and no team
    // invitation, see organization below) until the link in the email is clicked
    requireEmailVerification: true,
    password: {
      hash: hashPassword,
      verify: async ({ hash, password }) =>
        hash.startsWith(LEGACY_PREFIX)
          ? verifyLegacyPassword(hash, password)
          : verifyPassword({ hash, password }),
    },
    // /forgot-password → email → /reset-password?token=…; every device is signed out afterwards
    sendResetPassword: async ({ user, url }) => {
      sendResetPasswordEmail(user, url);
    },
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      sendPasswordChangedEmail(user);
    },
  },
  // /signup → email with /api/auth/verify-email?token=… → signed in and sent to callbackURL.
  // A password sign-in on an unverified account sends a fresh link (accounts made before this).
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      sendVerificationEmail(user, url);
    },
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },
  // Providers redirect to <BETTER_AUTH_URL>/api/auth/callback/<provider>, proxied by Next
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      // Lets the bot add the user to our server (see joinDiscordGuild)
      scope: ["guilds.join"],
    },
  },
  account: {
    accountLinking: {
      // "Ma chaîne" links the Google account that owns the YouTube channel, often
      // not the one the user signed up with (brand accounts, another address)
      allowDifferentEmails: true,
    },
  },
  user: {
    additionalFields: {
      plan: { type: "string", input: false, defaultValue: "Pro" },
      // Null until /onboarding is finished or skipped; the (app) layout sends the user there
      onboardedAt: { type: "date", input: false, required: false, fieldName: "onboarded_at" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Every new account starts with its DiceBear avatar, seeded by email
        before: async (user) => ({ data: { ...user, image: getDicebearAvatar(user.email) } }),
        after: async (user) => {
          sendWelcomeEmail(user);
        },
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
    // Every sign-in after the first one sends a "new sign-in" email; every sign-in
    // and sign-up is posted to Discord with where the visitor came from
    session: {
      create: {
        after: async (session, ctx) => {
          alertOnSignIn(session, ctx).catch((err) => console.error("[mail] sign-in alert:", err.message));
          postSignIn(session, ctx).catch((err) => console.error("[discord] sign-in:", err.message));
        },
      },
    },
    // Each Discord sign-in (new account or fresh tokens) joins the user to our server
    account: {
      create: { after: joinOnDiscordSignIn },
      update: { after: joinOnDiscordSignIn },
    },
  },
  plugins: [
    admin(),
    // Teams (/team): members share folders and followed channels (lib/teams.js)
    organization({
      invitationExpiresIn: INVITATION_DAYS * 24 * 60 * 60,
      cancelPendingInvitationsOnReInvite: true,
      // Invitations go by email: only a verified owner of that address may accept one
      requireEmailVerificationOnInvitation: true,
      // Emailed, and /team still shows the link (/invite/<id>) to copy and send another way
      sendInvitationEmail: async ({ id, email, organization, inviter }) => {
        const url = `${process.env.CLIENT_ORIGIN}/invite/${id}`;
        console.log(`[teams] Invitation to "${organization.name}" for ${email}: ${url}`);
        sendTeamInvitationEmail({ email, teamName: organization.name, inviterName: inviter?.user?.name, url, days: INVITATION_DAYS });
      },
    }),
  ],
});
