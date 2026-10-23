// Transactional emails through Resend, rendered by the "account-notification" template
// made in the Resend dashboard (https://resend.com/docs/api-reference/emails/send-email).
// Without RESEND_API_KEY the email is only logged, so local setups keep working.

const BRAND = "Returbe";
const DEFAULT_FROM = `${BRAND} <onboarding@resend.dev>`;
const TEMPLATE = process.env.RESEND_TEMPLATE || "account-notification";

const appUrl = (path = "/") => `${process.env.CLIENT_ORIGIN || "http://localhost:3000"}${path}`;

/**
 * The template's variables for one email. `message` is a list of sentences shown
 * as one paragraph; the template already says "Bonjour {{first_name}},".
 */
export function templateVariables({ firstName, heading, preview, message, button }) {
  return {
    email_title: heading,
    email_heading: heading,
    email_preview: preview ?? message[0] ?? heading,
    first_name: firstName || "toi",
    email_message: message.join(" "),
    cta_text: button.label,
    cta_url: button.url,
    x_url: process.env.EMAIL_X_URL || "https://x.com/returbe",
    instagram_url: process.env.EMAIL_INSTAGRAM_URL || "https://instagram.com/returbe",
    unsubscribe_url: appUrl("/settings"),
  };
}

/** Sends one email with the template; returns the Resend id, or null when skipped or failed. Never throws. */
export async function sendEmail({ to, subject, ...content }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[mail] RESEND_API_KEY missing, not sent to ${to}: ${subject}`);
    return null;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [to],
        subject,
        template: { id: TEMPLATE, variables: templateVariables(content) },
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[mail] "${subject}" to ${to} failed (${res.status}): ${data.message ?? res.statusText}`);
      return null;
    }
    return data.id ?? null;
  } catch (err) {
    console.error(`[mail] "${subject}" to ${to} failed:`, err.message);
    return null;
  }
}

export { BRAND, appUrl };
