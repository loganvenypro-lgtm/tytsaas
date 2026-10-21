const STOPWORDS = new Set(
  `the a an and or of to in on for with is are was be this that it my your you i me we they he she his her at by from as
  how what why who when where vs not no do does did can will just new video videos official full part shorts short
  youtube channel day days year years first best top get got make made one two all out up into about over more most so
  if but its le la les de des du un une et en est pour pas qui que sur avec dans ce mon ma il elle on je tu nous vous
  aujourd hui pourquoi comment quand entre tout tous toute plus sans aux par mais très cette ces son ses leur nos vos jour ont fait faire être avoir`.split(/\s+/),
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

/** Most frequent non-null value, or null. */
export function mode(values) {
  const freq = new Map();
  for (const v of values) if (v != null) freq.set(v, (freq.get(v) ?? 0) + 1);
  return [...freq].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
