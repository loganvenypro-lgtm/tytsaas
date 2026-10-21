/**
 * Title hooks: the psychological structures that make people click. A title can
 * carry several (stored as an array, filterable with "any of").
 * Each regex is tested on the raw title, case-insensitively.
 */
export const HOOKS = [
  { id: "number", label: { en: "Number in title", fr: "Chiffre dans le titre" }, re: /\d/ },
  { id: "money", label: { en: "Money", fr: "Argent" }, re: /[$€£]\s?\d|\d\s?[$€£]|\b\d+[,.]?\d*\s?(k|m|million|billion|milliards?)\s?(dollars|euros|\$|€)|\bdollars?\b|\beuros?\b/iu },
  { id: "question", label: { en: "Question", fr: "Question" }, re: /\?\s*$|^(why|how|what|who|which|is|are|can|does|did|should|would|pourquoi|comment|qui|quoi|est-ce)\b/iu },
  { id: "first_person", label: { en: "First person (I / we)", fr: "Première personne (je / on)" }, re: /^(i|i'm|i've|we|we're|my|j'ai|je|on a|nous|mon|ma|mes)\b/iu },
  { id: "challenge_duration", label: { en: "Time-boxed challenge", fr: "Défi chronométré" }, re: /\b(i|we|j'ai|on a)\b.*\b\d+\s*(hours?|days?|weeks?|months?|years?|heures?|jours?|semaines?|mois|ans)\b|\b\d+\s*(hours?|days?|heures?|jours?)\s+(in|à|on|without|sans|dans)\b/iu },
  { id: "superlative", label: { en: "Superlative (most, best, worst)", fr: "Superlatif (le plus, le pire)" }, re: /\b(most|best|worst|biggest|largest|smallest|richest|poorest|fastest|cheapest|deadliest|craziest|hardest|strongest|le plus|la plus|les plus|le pire|la pire|le meilleur|la meilleure)\b/iu },
  { id: "extreme", label: { en: "Extreme / ever / history", fr: "Extrême / jamais / histoire" }, re: /\b(ever|in history|of all time|impossible|insane|world'?s|never seen|dans l'histoire|de tous les temps|jamais vu|incroyable)\b/iu },
  { id: "curiosity_gap", label: { en: "Curiosity gap", fr: "Effet de curiosité" }, re: /\b(the (real|true|hidden|dark) (reason|truth|story|side)|nobody (talks about|knows|tells you)|you (won't|didn't|never) (believe|know|knew)|this is why|here'?s why|what (really|actually) happened|the truth about|personne ne (parle|sait|vous dit)|la vraie raison|la vérité sur|ce que personne)\b/iu },
  { id: "warning", label: { en: "Warning / mistakes", fr: "Avertissement / erreurs" }, re: /\b(stop (doing|using|buying|making)|don'?t (do|buy|make|watch)|do not|never (do|buy|eat)|avoid|mistakes?|warning|n'achetez|ne faites (jamais|pas)|erreurs?|arrêtez|attention)\b/iu },
  { id: "versus", label: { en: "Versus", fr: "Duel (vs)" }, re: /(^|\s)(vs\.?|versus|contre)\s/iu },
  { id: "transformation", label: { en: "Transformation (from → to)", fr: "Transformation (avant → après)" }, re: /\b(from .+ to .+|before (and|&) after|went from|turned .+ into|avant[ /]après|de .+ à .+ en)\b/iu },
  { id: "rise_fall", label: { en: "Rise and fall", fr: "Ascension et chute" }, re: /\b(rise and fall|the (downfall|collapse|death) of|what happened to|l'ascension et la chute|la chute de|qu'est-il arrivé)\b/iu },
  { id: "secret_reveal", label: { en: "Secret / reveal", fr: "Secret / révélation" }, re: /\b(secrets?|revealed|exposed|exposing|finally|hidden|leaked|révélé|enfin|caché)\b/iu },
  { id: "urgency_new", label: { en: "Urgency / newness", fr: "Urgence / nouveauté" }, re: /\b(now|right now|today|just|new|before it'?s too late|breaking|2025|2026|2027|maintenant|aujourd'hui|nouveau|nouvelle|enfin)\b/iu },
  { id: "negativity", label: { en: "Negative framing", fr: "Cadrage négatif" }, re: /\b(worst|terrible|horrible|disaster|failed|failure|ruined|scam|dying|dead|destroyed|catastrophe|pire|arnaque|ruiné|détruit|échec)\b/iu },
  { id: "authority_proof", label: { en: "Authority / proof", fr: "Autorité / preuve" }, re: /\b(scientists?|experts?|doctors?|harvard|study|studies|proven|proof|data|scientifiques?|médecins?|étude|prouvé|preuve)\b/iu },
  { id: "all_caps", label: { en: "WORD IN CAPS", fr: "MOT EN MAJUSCULES" }, re: /\b[A-Z]{3,}\b/u },
  { id: "list", label: { en: "List (N things)", fr: "Liste (N choses)" }, re: /^(top\s*)?\d+\s+\p{L}+/iu },
];

export const HOOK_BY_ID = Object.fromEntries(HOOKS.map((h) => [h.id, h]));
