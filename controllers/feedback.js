import { sendDiscord, truncate } from "../lib/discord.js";

const KINDS = { bug: "🐛 Bug", idea: "💡 Idée", other: "💬 Autre" };
const MAX_LENGTH = 2000;
// Per-user throttle, in memory: enough to stop a stuck button or a spammer
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const recent = new Map();

function throttled(userId) {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return true;
  recent.set(userId, [...hits, now]);
  return false;
}

/** POST /api/feedback { message, kind, page }: posted to DISCORD_FEEDBACK_WEBHOOK_URL. */
export async function send(req, res) {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const kind = KINDS[req.body?.kind] ? req.body.kind : "other";
  const page = typeof req.body?.page === "string" ? truncate(req.body.page, 200) : "";
  if (!message) return res.status(400).json({ error: "Écris un message." });
  if (message.length > MAX_LENGTH) return res.status(400).json({ error: `${MAX_LENGTH} caractères maximum.` });
  if (throttled(req.user.id)) return res.status(429).json({ error: "Trop d'envois, réessaie dans quelques minutes." });

  const ok = await sendDiscord(process.env.DISCORD_FEEDBACK_WEBHOOK_URL, {
    username: "Returbe Feedback",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: KINDS[kind],
        description: message,
        color: kind === "bug" ? 0xe5484d : kind === "idea" ? 0xf5a524 : 0x5865f2,
        fields: [
          { name: "Utilisateur", value: truncate(`${req.user.name} · ${req.user.email}`, 1024), inline: true },
          ...(page ? [{ name: "Page", value: page, inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
  if (!ok) return res.status(502).json({ error: "Envoi impossible pour le moment." });
  res.json({ ok: true });
}
