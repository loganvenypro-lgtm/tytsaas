import { pool } from "./db.js";
import { sendDiscord, stamp, truncate } from "./discord.js";

/**
 * Every sign-in and sign-up posted to DISCORD_SIGNIN_WEBHOOK_URL: who, new or
 * returning account, how they signed in, IP, device and where they came from
 * (the tyt_src cookie written by frontend/lib/visit-source.ts).
 */

const NEW_ACCOUNT_MS = 2 * 60 * 1000;

/** The tyt_src cookie: { first, last } visits, or {} when missing or malformed. */
export function parseVisitSource(cookieHeader) {
  const raw = cookieHeader
    ?.split(/;\s*/)
    .find((c) => c.startsWith("tyt_src="))
    ?.slice("tyt_src=".length);
  if (!raw) return {};
  try {
    const value = JSON.parse(decodeURIComponent(raw));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|qwant|brave)\./;
const SOCIAL = { "youtube.com": "YouTube", "youtu.be": "YouTube", "t.co": "X / Twitter", "x.com": "X / Twitter", "twitter.com": "X / Twitter", "discord.com": "Discord", "reddit.com": "Reddit", "tiktok.com": "TikTok", "instagram.com": "Instagram", "facebook.com": "Facebook", "linkedin.com": "LinkedIn" };

/** "Blog (blog.example.com/post)", "Recherche Google", "YouTube", "Direct"… */
export function describeTouch(touch) {
  if (!touch) return "Inconnue";
  if (touch.utm_source) {
    const extra = [touch.utm_medium, touch.utm_campaign].filter(Boolean).join(" / ");
    return `Campagne **${touch.utm_source}**${extra ? ` (${extra})` : ""}`;
  }
  if (touch.ref) return `Lien ?ref=**${touch.ref}**`;
  if (!touch.referrer) return "Direct (URL tapée, favori ou appli)";
  let url;
  try {
    url = new URL(touch.referrer);
  } catch {
    return truncate(touch.referrer, 100);
  }
  const host = url.host.replace(/^www\.|^m\./, "");
  const where = truncate(host + (url.pathname !== "/" ? url.pathname : ""), 100);
  if (/blog/i.test(host + url.pathname)) return `Blog (${where})`;
  const engine = host.match(SEARCH)?.[2];
  if (engine) return `Recherche ${engine[0].toUpperCase()}${engine.slice(1)}`;
  const social = Object.entries(SOCIAL).find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  if (social) return `${social[1]} (${where})`;
  return `Site externe (${where})`;
}

/** "Chrome · Windows", "Safari · iPhone"… */
export function describeDevice(userAgent) {
  if (!userAgent) return "Inconnu";
  const ua = userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Autre navigateur";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Autre OS";
  return `${browser} · ${os}`;
}

/** "/sign-in/email" → "Email", "/callback/google" → "Google"… */
function describeMethod(path = "") {
  const provider = path.match(/\/callback\/([\w-]+)/)?.[1];
  if (provider) return provider[0].toUpperCase() + provider.slice(1);
  if (/email/.test(path)) return "Email + mot de passe";
  if (/reset-password/.test(path)) return "Après réinitialisation du mot de passe";
  return path || "Inconnue";
}

export async function postSignIn(session, ctx) {
  const webhook = process.env.DISCORD_SIGNIN_WEBHOOK_URL;
  if (!webhook || session.impersonatedBy) return;

  const { rows } = await pool.query(
    `SELECT u.name, u.email, u."createdAt", u.plan, u.onboarded_at,
            (SELECT count(*) FROM session s WHERE s."userId" = u.id) AS sessions
     FROM "user" u WHERE u.id = $1`,
    [session.userId]
  );
  const user = rows[0];
  if (!user) return;

  const isNew = Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_MS;
  const headers = ctx?.headers ?? ctx?.request?.headers;
  const { first, last } = parseVisitSource(headers?.get?.("cookie"));
  const country = headers?.get?.("cf-ipcountry") ?? headers?.get?.("x-vercel-ip-country");

  const fields = [
    { name: "Compte", value: isNew ? "🆕 Nouveau compte" : `Existant, créé ${stamp(user.createdAt)}`, inline: true },
    { name: "Méthode", value: describeMethod(ctx?.path), inline: true },
    { name: "Plan", value: user.plan ?? "—", inline: true },
    { name: "IP", value: `\`${session.ipAddress || "inconnue"}\`${country ? ` · ${country}` : ""}`, inline: true },
    { name: "Appareil", value: describeDevice(session.userAgent), inline: true },
    { name: "Onboarding", value: user.onboarded_at ? "Fait" : "Pas encore", inline: true },
    { name: "Source (1re visite)", value: describeTouch(first) + (first?.at ? ` · ${stamp(first.at)}` : "") },
  ];
  if (last && last.at !== first?.at) fields.push({ name: "Source (dernière visite)", value: describeTouch(last) + ` · ${stamp(last.at)}` });
  if (first?.landing) fields.push({ name: "Page d'arrivée", value: `\`${truncate(first.landing, 100)}\``, inline: true });
  if (!isNew) fields.push({ name: "Sessions ouvertes", value: String(user.sessions), inline: true });

  await sendDiscord(webhook, {
    username: "TYT Connexions",
    embeds: [
      {
        title: `${isNew ? "🆕 Inscription" : "🔑 Connexion"} · ${truncate(user.name || user.email, 80)}`,
        description: user.email,
        color: isNew ? 0x22c55e : 0x5865f2,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
