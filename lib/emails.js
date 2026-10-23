import { BRAND, appUrl, sendEmail } from "./mail.js";

// The emails the app sends, in French like the rest of the user-facing copy, all
// rendered by the Resend template (lib/mail.js). Each one is fire-and-forget:
// a mail failure is logged and never blocks the request.

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";

const parisTime = (date) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(date);

/** "Chrome sur Windows" from a user agent; good enough to recognise one's own device. */
export function describeDevice(userAgent) {
  const ua = String(userAgent || "");
  const browser =
    /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os =
    /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  if (browser && os) return `${browser} sur ${os}`;
  return browser || os || "un appareil inconnu";
}

export function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: `Bienvenue sur ${BRAND}`,
    firstName: firstName(user.name),
    heading: `Bienvenue sur ${BRAND}`,
    message: [
      `Ton compte ${BRAND} est prêt.`,
      "Dis-nous qui tu es et quelles chaînes suivre : on s'occupe de repérer les vidéos qui explosent dans ta niche.",
    ],
    button: { label: "Commencer", url: appUrl("/onboarding") },
  });
}

export function sendNewSignInEmail(user, { userAgent, ipAddress, at = new Date() }) {
  return sendEmail({
    to: user.email,
    subject: `Nouvelle connexion à ${BRAND}`,
    firstName: firstName(user.name),
    heading: "Nouvelle connexion à ton compte",
    message: [
      `Quelqu'un vient de se connecter à ton compte ${BRAND} le ${parisTime(at)},`,
      `depuis ${describeDevice(userAgent)}${ipAddress ? ` (IP ${ipAddress})` : ""}.`,
      "Si c'est toi, tu n'as rien à faire. Sinon, change ton mot de passe tout de suite.",
    ],
    button: { label: "Changer mon mot de passe", url: appUrl("/forgot-password") },
  });
}

export function sendVerificationEmail(user, url) {
  return sendEmail({
    to: user.email,
    subject: `Confirme ton adresse email ${BRAND}`,
    firstName: firstName(user.name),
    heading: "Confirme ton adresse email",
    message: [
      `Clique sur le bouton ci-dessous pour activer ton compte ${BRAND}. Le lien est valable 1 heure.`,
      "Si tu n'as pas créé de compte, ignore cet email.",
    ],
    button: { label: "Confirmer mon email", url },
  });
}

export function sendResetPasswordEmail(user, url) {
  return sendEmail({
    to: user.email,
    subject: `Réinitialise ton mot de passe ${BRAND}`,
    firstName: firstName(user.name),
    heading: "Réinitialise ton mot de passe",
    message: [
      "Tu as demandé à changer ton mot de passe. Le lien ci-dessous est valable 1 heure.",
      "Si ce n'est pas toi, ignore cet email : ton mot de passe reste le même.",
    ],
    button: { label: "Choisir un nouveau mot de passe", url },
  });
}

export function sendPasswordChangedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: `Mot de passe ${BRAND} modifié`,
    firstName: firstName(user.name),
    heading: "Ton mot de passe a été changé",
    message: [
      `Le mot de passe de ton compte ${BRAND} vient d'être modifié, et tous tes appareils ont été déconnectés.`,
      "Si ce n'est pas toi, réinitialise-le tout de suite et réponds à cet email.",
    ],
    button: { label: "Me connecter", url: appUrl("/login") },
  });
}

export function sendTeamInvitationEmail({ email, teamName, inviterName, url, days }) {
  return sendEmail({
    to: email,
    subject: `${inviterName || "On"} t'invite sur ${BRAND}`,
    heading: `Rejoins l'équipe ${teamName}`,
    message: [
      `${inviterName || "Un membre"} t'invite à rejoindre l'équipe « ${teamName} » sur ${BRAND} : vous partagerez vos dossiers et les chaînes suivies.`,
      `L'invitation expire dans ${days} jours. Si tu ne connais pas cette personne, ignore cet email.`,
    ],
    button: { label: "Rejoindre l'équipe", url },
  });
}

/** A new recap is out (users who turned the email on in their settings). */
export function sendDigestEmail(user, frequency) {
  const monthly = frequency === "monthly";
  return sendEmail({
    to: user.email,
    subject: monthly ? "Ton récap du mois est prêt" : "Ton récap de la semaine est prêt",
    firstName: firstName(user.name),
    heading: monthly ? "Ton mois en un coup d'œil" : "Ta semaine en un coup d'œil",
    message: [
      `Les vidéos qui ont le mieux marché dans ta niche ${monthly ? "ce mois-ci" : "cette semaine"}, et ce qu'a fait ta chaîne.`,
      "Tu peux changer le jour, l'heure ou couper cet email dans tes paramètres.",
    ],
    button: { label: "Voir mon récap", url: appUrl("/") },
  });
}
