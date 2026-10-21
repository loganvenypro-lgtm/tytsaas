/**
 * Video formats ("style" of a video), detected from the title, tags, duration
 * and YouTube category. A video gets one format: the best score at or above
 * FORMAT_MIN_SCORE, among formats whose duration rules it satisfies.
 *
 * minSeconds / maxSeconds: hard limits (a 40 s Short is never a documentary).
 * longBonus: [seconds, weight] added when the video is at least that long.
 * categories: YouTube category id -> weight.
 */
export const FORMAT_MIN_SCORE = 3;

export const FORMATS = [
  {
    id: "documentary",
    label: { en: "Documentary", fr: "Documentaire" },
    terms: [
      ["documentar(y|ies|io)|documentaire|doku", 6], ["the (untold |true |full |real |insane |tragic )?story of", 3.5],
      ["rise and fall", 5], ["the (history|downfall|collapse) of", 4], ["l'histoire (de|du|des|incroyable)", 4],
      ["inside (the|a|north|china)", 2.5], ["what happened to", 3], ["investigat(ion|ing)|enquête", 3], ["full film", 3],
    ],
    minSeconds: 420,
    longBonus: [1200, 1.5],
  },
  {
    id: "video_essay",
    label: { en: "Video essay & analysis", fr: "Analyse & video essay" },
    terms: [
      ["video essay", 7], ["the problem with", 4], ["the death of", 4], ["the (decline|downfall) of", 3], ["analysis", 3],
      ["analyse|décryptage|décrypter", 4], ["why (does|do|is|are|did|was|were) ", 2.5], ["pourquoi", 2], ["explained", 2],
      ["iceberg", 4], ["deep dive", 4], ["breakdown", 3], ["the psychology of", 4], ["is (dying|dead|ruined|broken)", 3],
    ],
    minSeconds: 360,
    longBonus: [900, 1],
  },
  {
    id: "tutorial",
    label: { en: "Tutorial & how-to", fr: "Tutoriel" },
    terms: [
      ["how to", 4], ["tutorial|tuto(riel)?", 6], ["step[- ]by[- ]step", 5], ["guide", 3], ["beginners?|débutants?", 3],
      ["comment (faire|créer|installer|gagner|avoir|utiliser|réussir|obtenir|devenir)", 4.5], ["learn", 2], ["course|cours|formation", 3],
      ["tips (and|&) tricks", 4], ["(full|complete|ultimate) (guide|course|tutorial)", 5], ["setup|install(ation)?", 2.5],
      ["c[oó]mo (hacer|crear)", 4], ["anleitung", 5], ["in \\d+ (minutes|steps|étapes)", 2], ["masterclass", 4], ["fix(ed)?", 1.5],
    ],
    categories: { 26: 1, 27: 1 },
  },
  {
    id: "listicle",
    label: { en: "Listicle (Top N)", fr: "Liste (Top N)" },
    terms: [
      ["top ?\\d+", 6],
      [
        "\\d+ (things|ways|reasons|signs|tips|facts|mistakes|secrets|habits|tools|apps|games|places|movies|books|lessons|rules|steps|ideas|hacks|choses|raisons|astuces|erreurs|conseils|façons|signes|habitudes|règles|leçons|idées)",
        6,
      ],
      ["^\\d+ ", 2], ["you (need|should) (know|try)", 2],
    ],
  },
  {
    id: "ranking",
    label: { en: "Ranking & tier list", fr: "Classement & tier list" },
    terms: [
      ["tier ?list", 7], ["ranking|ranked", 5], ["classement|classé", 5], ["(from )?worst to best|best to worst", 6],
      ["every .* ranked", 6], ["i ranked", 6], ["du pire au meilleur", 6],
    ],
  },
  {
    id: "review",
    label: { en: "Review & unboxing", fr: "Test & unboxing" },
    terms: [
      ["review", 4.5], ["unboxing", 6], ["hands[- ]on", 5], ["worth (it|buying)", 4], ["avis", 3], ["test (du|de la|des|complet)", 4],
      ["first impressions?", 5], ["honest", 2], ["after \\d+ (months|days|years|weeks)", 3], ["après \\d+ (mois|jours|ans)", 3],
      ["don't buy|n'achetez pas", 4], ["vs\\.? .* (which|lequel)", 2], ["is it (good|worth)", 4], ["tested", 2.5],
    ],
  },
  {
    id: "reaction",
    label: { en: "Reaction", fr: "Réaction" },
    terms: [
      ["react(s|ing|ion)?( to)?", 4.5], ["réagi[ts]|réaction|je réagis", 5], ["first time (hearing|watching|reacting)", 6],
      ["watching", 1.5], ["responds? to", 2],
    ],
  },
  {
    id: "challenge",
    label: { en: "Challenge", fr: "Défi" },
    terms: [
      ["challenge", 5], ["défi", 5], ["\\d+ (hours|days|heures|jours|nights|nuits) (in|à|on|without|sans|dans|inside)", 5],
      ["last to (leave|stop|take|survive)", 6], ["\\$\\d+[\\d,]* vs \\$\\d+", 5], ["i (survived|spent) \\d+", 5], ["dernier à", 5],
      ["qui (gagne|perd)", 2.5], ["survive \\d+", 4], ["(won|win) \\$", 3], ["no (food|sleep|phone) for", 4], ["24h", 2],
    ],
  },
  {
    id: "experiment",
    label: { en: "Experiment & test", fr: "Expérience & test" },
    terms: [
      ["i tried", 5], ["i tested", 5], ["what happens (if|when)", 5], ["experiment", 4.5], ["j'ai (testé|essayé)", 5], ["we tested", 4],
      ["que se passe[- ]t[- ]il (si|quand)", 5], ["can (you|i|it) (really|actually)", 3], ["does it (work|actually)", 4],
      ["i (bought|built|ate|lived|followed|asked)", 2.5], ["j'ai (acheté|construit|mangé|vécu|suivi)", 2.5],
    ],
  },
  {
    id: "storytime",
    label: { en: "Story & narration", fr: "Histoire & narration" },
    terms: [
      ["storytime|story ?time", 7], ["reddit", 4], ["r/[a-z]+", 5], ["aita|am i the", 6], ["entitled", 3],
      ["my (boyfriend|girlfriend|husband|wife|boss|parents?|sister|brother|ex|mom|dad|neighbor|teacher)", 3],
      ["histoire vraie|mon histoire|true story", 4], ["revenge", 2], ["karen", 2], ["(scary|horror) stor(y|ies)", 5], ["creepypasta", 5],
    ],
  },
  {
    id: "news_commentary",
    label: { en: "News & commentary", fr: "Actu & commentaire" },
    terms: [
      ["breaking", 4], ["just (happened|got|announced|dropped|leaked)", 3.5], ["update", 1.5], ["news", 3], ["actu(alité)?s?", 3],
      ["exposed", 3.5], ["drama", 2.5], ["responds?|répond", 2.5], ["situation", 2.5], ["is (over|done|finished)", 3],
      ["the truth about", 2.5], ["controvers(y|e)", 3.5], ["scandal|scandale", 3.5], ["officially", 2], ["leaked", 3], ["clash", 1.5],
    ],
    categories: { 25: 2 },
  },
  {
    id: "interview_podcast",
    label: { en: "Interview & podcast", fr: "Interview & podcast" },
    terms: [
      ["podcast", 6], ["interview", 5], ["entretien", 4], ["ep(isode)?\\.? ?#?\\d+", 2], ["#\\d+ ?[-–|:]", 2.5], ["ft\\.?|feat\\.?", 1],
      ["(sits|sat) down with", 5], ["conversation with", 5], ["q ?& ?a", 3], ["talks? about", 2], ["face à", 3],
    ],
    minSeconds: 600,
    longBonus: [2400, 2.5],
  },
  {
    id: "compilation",
    label: { en: "Compilation & highlights", fr: "Compilation & best-of" },
    terms: [
      ["compilation", 7], ["best (of|moments)", 5], ["meilleurs moments", 5], ["funniest", 4.5], ["moments", 2.5], ["fails?", 3],
      ["highlights", 5], ["résumé du match", 5], ["clips?", 2], ["(all|every) .* (ever|in history)", 2], ["montage", 3],
    ],
  },
  {
    id: "gameplay",
    label: { en: "Gameplay & let's play", fr: "Gameplay & let's play" },
    terms: [
      ["gameplay", 6], ["let'?s play", 6], ["playthrough", 6], ["walkthrough", 6], ["part \\d+", 2.5], ["ep(isode)? ?\\d+", 1.5],
      ["hardcore", 3], ["speedrun", 5], ["no commentary", 5], ["full game", 6], ["smp", 3], ["survival (series|world)", 3.5],
      ["\\d+ days in", 3], ["but every", 3], ["mais (chaque|à chaque)", 3], ["i beat", 4], ["ranked", 2], ["noob vs pro", 5],
    ],
    categories: { 20: 3 },
  },
  {
    id: "vlog",
    label: { en: "Vlog", fr: "Vlog" },
    terms: [
      ["vlog", 7], ["day in (the|my) life", 6], ["a day (in|with|at)", 3.5], ["my (morning|night|daily) routine", 5.5], ["routine", 2],
      ["come with me|viens avec moi", 5], ["week in my life", 6], ["moving (to|vlog|in)", 2.5], ["grwm|get ready with me", 5],
      ["house tour|room tour", 4], ["what i eat in a day", 6],
    ],
    categories: { 22: 1.5 },
  },
  {
    id: "case_study",
    label: { en: "Case study & success story", fr: "Étude de cas & success story" },
    terms: [
      ["how (i|he|she|they|this|one (guy|man|woman|kid)|a \\d+[- ]year[- ]old) (made|makes|built|started|grew|scaled|earned|went|turned|became|got)", 6],
      ["case study|étude de cas", 6], ["\\$[\\d,.]+[kKmM]? (in|per|a) (month|day|year|week)", 3.5], ["from \\$?\\d+ to \\$?\\d+", 3.5],
      ["made \\$", 3], ["comment (il|elle|j'ai|ils) (a |ont )?(gagné|créé|construit|fait)", 5], ["the genius (of|behind)", 4],
    ],
  },
  {
    id: "comparison",
    label: { en: "Comparison & versus", fr: "Comparatif & duel" },
    terms: [
      ["(^|\\s)vs\\.?\\s", 4], ["versus", 4], ["which (is|one is) better|lequel (choisir|est le meilleur)", 5],
      ["compar(ed|ison|atif)", 4.5], ["\\bcontre\\b", 1.5], ["difference between", 4],
    ],
  },
  {
    id: "recap",
    label: { en: "Recap & summary", fr: "Résumé & recap" },
    terms: [
      ["recap(ped)?", 6], ["explained in \\d+", 5], ["summar(y|ized)|résumé", 4.5], ["movie recap", 7], ["the plot of", 4],
      ["ending explained", 5], ["in \\d+ minutes", 2.5], ["everything you need to know", 3],
    ],
  },
  {
    id: "prank",
    label: { en: "Prank", fr: "Prank" },
    terms: [["prank(ed|ing|s)?", 7], ["caméra cachée|hidden camera", 6], ["trolling|troll(ed)?", 3.5], ["piégé", 3]],
  },
  {
    id: "asmr_ambience",
    label: { en: "ASMR & ambience", fr: "ASMR & ambiance" },
    terms: [
      ["asmr", 8], ["sleep (sounds|music)|white noise|brown noise|relaxing (music|sounds)", 6], ["ambien(ce|t)|ambiance", 3.5],
      ["oddly satisfying", 5], ["\\d+ hours? of", 3],
    ],
  },
  {
    id: "animation",
    label: { en: "Animation", fr: "Animation" },
    terms: [
      ["animation|animated|animé", 4], ["(minecraft|roblox|among us) animation", 6], ["cartoon", 3.5], ["skibidi", 3],
      ["stick ?man", 4], ["\\(animation\\)", 6],
    ],
  },
  {
    id: "music_video",
    label: { en: "Music video & song", fr: "Clip & musique" },
    terms: [["official (music )?video|clip officiel", 7], ["lyrics?|paroles", 5], ["official audio", 7], ["visuali[sz]er", 5], ["remix", 3]],
    categories: { 10: 4 },
  },
  {
    id: "livestream",
    label: { en: "Live stream", fr: "Live" },
    terms: [["live ?stream", 5], ["\\blive\\b", 1.5], ["en direct", 4], ["stream (highlights|vod)", 3]],
    minSeconds: 1800,
  },
];

export const FORMAT_BY_ID = Object.fromEntries(FORMATS.map((f) => [f.id, f]));
