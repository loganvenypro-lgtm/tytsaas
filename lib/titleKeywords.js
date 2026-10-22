const STOPWORDS = new Set(
  `the a an and or of to in on for with is are was be this that it my your you i me we they he she his her at by from as
  how what why who when where vs not no do does did can will just new video videos official full part shorts short
  youtube channel day days year years first best top get got make made one two all out up into about over more most so
  if but its le la les de des du un une et en est pour pas qui que sur avec dans ce mon ma il elle on je tu nous vous
  aujourd hui pourquoi comment quand entre tout tous toute plus sans aux par mais très cette ces son ses leur nos vos jour ont fait faire être avoir
  avait ils elles encore été était sont peut veut chez sous après avant depuis alors donc même aussi trop bien rien vidéo chaîne
  like since other others tell these those think took many called then than there their them here have has had would could
  should been being were which while after before only also some any every much very still even back down off again know
  want need going gonna let says said look see watch try tried use used way ways com www http https avez votre vos moi toi`.split(/\s+/),
);

/** The words that come back in the most titles (each title counts a word once), stopwords and numbers left out. */
export function topKeywords(titles, limit) {
  const counts = new Map();
  for (const title of titles) {
    const words = new Set(
      title
        .toLowerCase()
        // Drop elided articles ("l'ia" → "ia"), like PostgreSQL's tokenizer splits them; accents stay so keywords match its tsvector
        .replace(/(^|\s)\p{L}{1,2}['’]/gu, "$1")
        .replace(/[^\p{L}\p{N} ]+/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
    );
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/**
 * Hype and emotional words: they say how a title sells, not what the video is about.
 * Alone they never describe a channel ("dark", "crazy"); inside a bigram they can ("dark web").
 */
export const GENERIC_TERMS = new Set(
  `dark darker darkest crazy craziest insane insanely shocking shocked terrifying terrified scary scariest strange strangest
  weird weirdest deadly deadliest dangerous disturbing disgusting horrifying horrible terrible bizarre wild unbelievable
  incredible amazing epic ultimate huge massive giant biggest largest smallest worst greatest real really actually literally
  truth true secret secrets hidden untold exposed exposing revealed finally ever never everything nothing nobody everyone
  someone people man woman guy guys thing things story stories life time times world inside almost hard impossible
  feared valuable surprising famous perfect simple easy fast quick big small little good bad great happened
  fou folle dingue ouf incroyable choquant terrifiant horrible pire meilleur meilleure énorme vérité secret vrai vraie
  vraiment jamais personne histoire chose choses monde gens grand petit gros`.split(/\s+/),
);

/** Lower-cased words of a title in order, split like PostgreSQL's "simple" parser (so bigrams stay adjacent in its tsvector). */
function tokens(title) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ");
}

const isWord = (w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w);

/**
 * Words and two-word phrases of a set of titles, with how many titles hold each
 * (a title counts a term once). Generic words are left out on their own but kept
 * in bigrams next to a real word. Bigrams are "a b"; to_tsquery wants them as "a <-> b".
 */
export function titleTerms(titles) {
  const counts = new Map();
  for (const title of titles) {
    const words = tokens(title);
    const seen = new Set();
    words.forEach((w, i) => {
      if (isWord(w) && !GENERIC_TERMS.has(w)) seen.add(w);
      const next = words[i + 1];
      if (next && isWord(w) && isWord(next) && !(GENERIC_TERMS.has(w) && GENERIC_TERMS.has(next))) seen.add(`${w} ${next}`);
    });
    for (const t of seen) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/** Most frequent non-null value, or null. */
export function mode(values) {
  const freq = new Map();
  for (const v of values) if (v != null) freq.set(v, (freq.get(v) ?? 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
