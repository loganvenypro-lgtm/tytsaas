// Everything the classifier, the explore API and the worker agree on.
export { NICHES, NICHE_BY_ID, TOPIC_INDEX } from "./niches.js";
export { FORMATS, FORMAT_BY_ID, FORMAT_MIN_SCORE } from "./formats.js";
export { HOOKS, HOOK_BY_ID } from "./hooks.js";

/** YouTube video categories (snippet.categoryId). */
export const CATEGORIES = {
  1: { en: "Film & Animation", fr: "Films & animation" },
  2: { en: "Autos & Vehicles", fr: "Auto & véhicules" },
  10: { en: "Music", fr: "Musique" },
  15: { en: "Pets & Animals", fr: "Animaux" },
  17: { en: "Sports", fr: "Sport" },
  19: { en: "Travel & Events", fr: "Voyages & événements" },
  20: { en: "Gaming", fr: "Jeux vidéo" },
  22: { en: "People & Blogs", fr: "Vlogs & people" },
  23: { en: "Comedy", fr: "Humour" },
  24: { en: "Entertainment", fr: "Divertissement" },
  25: { en: "News & Politics", fr: "Actualité & politique" },
  26: { en: "Howto & Style", fr: "Tutos & style" },
  27: { en: "Education", fr: "Éducation" },
  28: { en: "Science & Technology", fr: "Science & tech" },
  29: { en: "Nonprofits & Activism", fr: "Associatif" },
};

/** Languages the classifier detects from text (ISO 639-1). */
export const LANGUAGES = {
  en: { en: "English", fr: "Anglais" },
  fr: { en: "French", fr: "Français" },
  es: { en: "Spanish", fr: "Espagnol" },
  pt: { en: "Portuguese", fr: "Portugais" },
  de: { en: "German", fr: "Allemand" },
  it: { en: "Italian", fr: "Italien" },
  nl: { en: "Dutch", fr: "Néerlandais" },
  tr: { en: "Turkish", fr: "Turc" },
  pl: { en: "Polish", fr: "Polonais" },
  id: { en: "Indonesian", fr: "Indonésien" },
  ru: { en: "Russian", fr: "Russe" },
  ar: { en: "Arabic", fr: "Arabe" },
  hi: { en: "Hindi", fr: "Hindi" },
  ja: { en: "Japanese", fr: "Japonais" },
  ko: { en: "Korean", fr: "Coréen" },
  zh: { en: "Chinese", fr: "Chinois" },
  th: { en: "Thai", fr: "Thaï" },
  vi: { en: "Vietnamese", fr: "Vietnamien" },
};

/** Bump when the taxonomy or the classifier changes: the worker reclassifies everything below it. */
export const CLASSIFIER_VERSION = 2;
