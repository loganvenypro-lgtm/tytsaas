/**
 * Channel / video niche classifier shared by onboarding, the personalised home,
 * similar channels and the taxonomy helpers.
 *
 * Each niche has a weighted vocabulary matched on word boundaries. A channel is
 * scored over all its titles (each title counts once per term) plus its name and
 * description, and the best-scoring niche wins. Order no longer matters, so a
 * dropshipping channel that says "secret" or posts 20-minute videos is not
 * pushed into true crime or documentary.
 */
export const NICHES = [
    {
        id: "business_ecommerce",
        label: "Business, E-commerce & Argent en ligne",
        terms: [
            ["drop ?shipping", 4], ["shopify", 4], ["e-?com(merce)?", 4], ["amazon fba", 4], ["fba", 3],
            ["tiktok shop", 4], ["print on demand", 4], ["winning products?", 4], ["product (research|validation)", 4],
            ["(facebook|fb|meta|tiktok|google) ads", 4], ["media buy(ing|er)", 4], ["roas", 4], ["cpms?", 3], ["ctr", 2],
            ["ads?", 2], ["ad creatives?", 4], ["ugc", 3], ["copywrit(ing|er)", 4], ["marketing", 3], ["marketer", 3],
            ["brands?(?![- ]new)", 2], ["branding", 3], ["store", 2], ["boutique", 2], ["sales", 2], ["selling", 2],
            ["customers?", 2], ["clients?", 2], ["agency", 3], ["smma", 4], ["side hustles?", 4], ["make money online", 5],
            ["make money", 3], ["making money", 3], ["passive income", 3], ["entrepreneurs?(hip)?", 3], ["entrepreneuriat", 3],
            ["business(es)?", 3], ["startups?", 2], ["scal(e|ing)", 2], ["revenue", 2], ["profits?", 2], ["funnels?", 3],
            ["conversions?", 2], ["affiliate", 3], ["saas", 2], ["\\$\\d+k?(/| per | a )(month|day|mo)", 4],
            ["\\d+k ?(/|per |a )(month|day|mo)", 4], ["argent en ligne", 5], ["gagner de l'argent", 4],
            ["chiffre d'affaires", 3], ["vendre", 2], ["vinted", 2], ["prospection", 3], ["offers?", 1],
        ],
        vocabulary: [
            "dropshipping", "dropship", "shopify", "ecommerce", "ecom", "fba", "ads", "roas", "ugc", "copywriting",
            "marketing", "marketer", "branding", "agency", "smma", "entrepreneur", "entrepreneurs", "business", "funnel",
            "affiliate", "hustle", "entrepreneuriat",
        ],
    },
    {
        id: "finance_investing",
        label: "Finance & Investissement",
        terms: [
            ["stocks?", 3], ["stock market", 4], ["invest(ing|ment|or)?s?", 3], ["crypto(currency)?", 4], ["bitcoin", 4],
            ["ethereum", 4], ["trading", 3], ["trader", 3], ["forex", 4], ["etfs?", 4], ["dividends?", 4], ["real estate", 4],
            ["immobilier", 4], ["bourse", 4], ["wealth", 2], ["millionaire", 2], ["billionaire", 2], ["economy", 2],
            ["recession", 3], ["inflation", 3], ["portfolio", 3], ["retire(ment)?", 2], ["budget(ing)?", 2], ["debt", 2],
            ["money", 1], ["finance", 3], ["financial", 2],
        ],
        vocabulary: [
            "stocks", "stock", "investing", "invest", "crypto", "bitcoin", "trading", "forex", "etf", "dividends",
            "immobilier", "bourse", "wealth", "finance", "portfolio",
        ],
    },
    {
        id: "tech_ai",
        label: "Tech & Intelligence Artificielle",
        terms: [
            ["ai", 2], ["chatgpt", 3], ["openai", 3], ["claude", 2], ["artificial intelligence", 4], ["software", 3],
            ["coding", 3], ["programming", 4], ["developer", 3], ["iphone", 3], ["apple", 2], ["android", 3], ["samsung", 3],
            ["smartphone", 3], ["laptop", 3], ["gadgets?", 3], ["pc build", 4], ["gpu", 3], ["tech", 2], ["python", 3],
            ["javascript", 3], ["linux", 3], ["review", 1],
        ],
        vocabulary: ["ai", "chatgpt", "software", "coding", "programming", "iphone", "android", "smartphone", "laptop", "gadget", "tech", "python"],
    },
    {
        id: "true_crime",
        label: "True Crime & Mystères",
        terms: [
            ["murders?", 4], ["killers?", 4], ["serial killer", 5], ["unsolved", 4], ["cold case", 5], ["disappear(ed|ance)", 3],
            ["missing", 2], ["crimes?", 3], ["criminal", 3], ["detectives?", 3], ["police", 2], ["cartel", 3], ["mystery", 2],
            ["mysteries", 2], ["creepy", 3], ["disturbing", 3], ["dark web", 4], ["conspiracy", 2], ["investigation", 2],
        ],
        vocabulary: ["murder", "killer", "unsolved", "crime", "criminal", "detective", "cartel", "mystery", "creepy", "disappeared"],
    },
    {
        id: "documentary_history",
        label: "Documentaire & Histoire",
        terms: [
            ["documentary", 4], ["documentaire", 4], ["video essay", 4], ["history", 3], ["historical", 3], ["ancient", 3],
            ["empire", 3], ["medieval", 3], ["ww2", 4], ["world war", 4], ["rise and fall", 4], ["downfall", 3],
            ["the story of", 2], ["the history of", 3], ["civilizations?", 3], ["roman", 2], ["egypt", 2], ["kings?", 1],
        ],
        vocabulary: ["documentary", "documentaire", "history", "historical", "ancient", "empire", "medieval", "ww2", "downfall"],
    },
    {
        id: "science_education",
        label: "Science & Éducation",
        terms: [
            ["science", 3], ["physics", 4], ["math(s|ematics)?", 3], ["biology", 4], ["chemistry", 4], ["space", 2],
            ["nasa", 3], ["universe", 3], ["quantum", 4], ["planets?", 2], ["engineering", 2], ["experiment", 2],
            ["explained", 1], ["psychology", 2],
        ],
        vocabulary: ["science", "physics", "math", "biology", "chemistry", "nasa", "universe", "quantum", "planet"],
    },
    {
        id: "gaming",
        label: "Gaming",
        terms: [
            ["minecraft", 4], ["roblox", 4], ["fortnite", 4], ["gta", 4], ["pokemon", 4], ["zelda", 4], ["speedrun", 4],
            ["gameplay", 4], ["gaming", 3], ["gamer", 3], ["video games?", 3], ["smp", 3], ["valorant", 4], ["call of duty", 4],
            ["elden ring", 4], ["nintendo", 3], ["playstation", 3], ["xbox", 3], ["steam", 2], ["boss", 1],
        ],
        vocabulary: ["minecraft", "roblox", "fortnite", "gta", "pokemon", "speedrun", "gameplay", "gaming", "smp", "valorant", "nintendo"],
    },
    {
        id: "challenge_entertainment",
        label: "Défis & Divertissement",
        terms: [
            ["challenge", 2], ["survived?", 2], ["hours in", 3], ["last to leave", 4], ["stunt", 3], ["giveaway", 2],
            ["mrbeast", 4], ["\\$1 vs", 4], ["24 hours", 2], ["100 days", 2], ["trapped", 2], ["prank", 2], ["vlog", 2],
        ],
        vocabulary: ["challenge", "survive", "stunt", "giveaway", "mrbeast", "trapped", "prank", "vlog"],
    },
    {
        id: "fitness_health",
        label: "Fitness, Santé & Lifestyle",
        terms: [
            ["workout", 4], ["gym", 3], ["fitness", 4], ["muscle", 3], ["fat loss", 4], ["weight loss", 4], ["diet", 3],
            ["nutrition", 3], ["protein", 3], ["calisthenics", 4], ["bodybuilding", 4], ["skincare", 3], ["sleep", 1],
            ["health", 2], ["healthy", 2], ["recipe", 2], ["cooking", 2],
        ],
        vocabulary: ["workout", "gym", "fitness", "muscle", "diet", "nutrition", "protein", "calisthenics", "bodybuilding", "health"],
    },
    {
        id: "sports",
        label: "Sport",
        terms: [
            ["football", 3], ["soccer", 3], ["nba", 4], ["nfl", 4], ["basketball", 3], ["ufc", 4], ["mma", 4], ["boxing", 3],
            ["olympics?", 3], ["athletes?", 2], ["messi", 4], ["ronaldo", 4], ["goals?", 1], ["champions league", 4], ["f1", 3],
        ],
        vocabulary: ["football", "soccer", "nba", "nfl", "basketball", "ufc", "mma", "boxing", "messi", "ronaldo"],
    },
    {
        id: "news_politics",
        label: "Actualité & Politique",
        terms: [
            ["politics", 4], ["political", 3], ["elections?", 4], ["president", 3], ["trump", 4], ["biden", 4], ["putin", 4],
            ["government", 3], ["senate", 4], ["congress", 3], ["geopolitics", 4], ["breaking news", 4], ["war in", 3],
            ["ukraine", 3], ["israel", 3], ["court", 2],
        ],
        vocabulary: ["politics", "election", "president", "trump", "biden", "putin", "government", "senate", "geopolitics"],
    },
    {
        id: "autos",
        label: "Automobile",
        terms: [
            ["cars?", 3], ["supercars?", 4], ["ferrari", 4], ["lamborghini", 4], ["porsche", 4], ["bmw", 4], ["engines?", 2],
            ["tuning", 3], ["drift", 3], ["trucks?", 2], ["tesla", 2], ["restoration", 2], ["motorcycle", 3],
        ],
        vocabulary: ["car", "cars", "supercar", "ferrari", "lamborghini", "porsche", "bmw", "engine", "tuning", "drift"],
    },
    {
        id: "comedy",
        label: "Humour & Memes",
        terms: [["memes?", 3], ["funny", 3], ["comedy", 4], ["try not to laugh", 5], ["skit", 3], ["parody", 3], ["humou?r", 3]],
        vocabulary: ["meme", "memes", "funny", "comedy", "skit", "parody"],
    },
    {
        id: "stories_drama",
        label: "Histoires & Drama",
        terms: [
            ["reddit", 4], ["aita", 5], ["storytime", 4], ["confessions?", 3], ["cheating", 3], ["girlfriend", 2],
            ["boyfriend", 2], ["husband", 2], ["wife", 2], ["drama", 2], ["entitled", 3],
        ],
        vocabulary: ["reddit", "aita", "storytime", "confession", "cheating", "drama", "entitled"],
    },
];
const COMPILED = NICHES.map((n) => ({
    ...n,
    regexes: n.terms.map(([src, weight]) => ({ re: new RegExp(`(^|[^\\p{L}\\p{N}])(${src})(?=$|[^\\p{L}\\p{N}])`, "iu"), weight })),
}));
export const NICHE_BY_ID = Object.fromEntries(NICHES.map((n) => [n.id, n]));
function scoreText(text) {
    const scores = new Map();
    if (!text)
        return scores;
    for (const niche of COMPILED) {
        let s = 0;
        for (const { re, weight } of niche.regexes)
            if (re.test(text))
                s += weight;
        if (s > 0)
            scores.set(niche.id, s);
    }
    return scores;
}
/** Classify a single title (plus optional context such as a search query). */
export function classifyTitle(title, context = "") {
    const scores = scoreText(`${title} ${context}`);
    let best = null;
    let bestScore = 0;
    for (const [id, s] of scores)
        if (s > bestScore)
            [best, bestScore] = [id, s];
    return best;
}
/**
 * Classify a channel from its titles, name and description. Each title votes
 * once per term; the name and description add a smaller, capped signal so a
 * long keyword-stuffed "about" section cannot outweigh the actual videos.
 */
export function classifyChannel(input) {
    const totals = new Map();
    const hits = new Map();
    const titles = input.titles.filter(Boolean);
    for (const title of titles) {
        for (const [id, s] of scoreText(title)) {
            totals.set(id, (totals.get(id) ?? 0) + s);
            hits.set(id, (hits.get(id) ?? 0) + 1);
        }
    }
    const meta = scoreText(`${input.name ?? ""} ${(input.description ?? "").slice(0, 1500)}`);
    const metaWeight = Math.max(2, titles.length / 4);
    for (const [id, s] of meta)
        totals.set(id, (totals.get(id) ?? 0) + Math.min(s, 12) * (metaWeight / 6));
    let best = null;
    let bestScore = 0;
    let sum = 0;
    for (const [id, s] of totals) {
        sum += s;
        if (s > bestScore)
            [best, bestScore] = [id, s];
    }
    const minScore = Math.max(3, titles.length * 0.4);
    if (!best || bestScore < minScore) {
        return { id: null, label: "Créateur généraliste", confidence: 0, coverage: 0, scores: Object.fromEntries(totals) };
    }
    return {
        id: best,
        label: NICHE_BY_ID[best].label,
        confidence: sum > 0 ? bestScore / sum : 0,
        coverage: titles.length ? (hits.get(best) ?? 0) / titles.length : 0,
        scores: Object.fromEntries(totals),
    };
}
/**
 * True when the title on its own clearly belongs to the niche: the niche is its
 * best match and scores at least `minScore` (one generic word like "brand" or "business" is not enough).
 */
export function titleMatchesNiche(title, id, minScore = 4) {
    const scores = scoreText(title);
    const own = scores.get(id) ?? 0;
    if (own < minScore)
        return false;
    for (const [other, s] of scores)
        if (other !== id && s > own)
            return false;
    return true;
}
/** `to_tsquery('simple', ...)` string that matches the niche's core vocabulary. */
export function nicheTsQuery(id) {
    if (!id)
        return null;
    return NICHE_BY_ID[id].vocabulary.join(" | ");
}
