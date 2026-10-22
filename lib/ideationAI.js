// AI help for ideation notes (controllers/folders.js): complete a note or fix
// its wording, using the saved video as context. Runs on Groq (OpenAI-compatible
// chat completions API); needs GROQ_API_KEY.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const aiEnabled = () => Boolean(process.env.GROQ_API_KEY);

export class AiRefusedError extends Error {}

const KIND_LABELS = {
  idea: "a video idea (concept, angle, what to do differently)",
  hook: "a hook: the first words spoken in the video, meant to stop the scroll",
  title: "a YouTube video title",
};

const SYSTEM = `You help a YouTube creator write notes while studying a video that performed well.
You receive the video (title, channel, format, stats), the kind of note and the creator's draft.
Reply with the finished note text only: no preamble, no quotes around it, no markdown, no explanation.
Write in the language of the draft; when the draft is empty, in the requested language.
Keep the creator's voice and intent. Stay short: a title fits on one line, a hook is one or two spoken
sentences, an idea is a few sentences at most.`;

const TASKS = {
  complete: (hasDraft) =>
    hasDraft
      ? "Complete this draft: keep what is written, finish the unfinished sentence and fill in what is missing. Return the whole note."
      : "The draft is empty: write one strong note of this kind, inspired by the video but not a copy of it.",
  fix: () =>
    "Fix spelling, grammar and punctuation, and make the wording clearer and punchier without changing the meaning. Return the whole corrected note.",
};

/**
 * @param {{ mode: "complete" | "fix", kind: string, body: string, locale: "fr" | "en", video: object }} input
 * @returns {Promise<string>} the new note text
 */
export async function assistNote({ mode, kind, body, locale, video }) {
  const context = [
    `Video title: ${video.title ?? "unknown"}`,
    video.channelName && `Channel: ${video.channelName}`,
    `Format: ${video.isShort ? "YouTube Short (vertical, under a minute)" : "long-form video"}`,
    video.views != null && `Views: ${video.views}`,
    video.multiplier != null && `Outlier score: ${Number(video.multiplier).toFixed(1)}x the channel's usual views`,
  ]
    .filter(Boolean)
    .join("\n");

  return chat(
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `<video>\n${context}\n</video>\n\nNote kind: ${KIND_LABELS[kind]}\nRequested language if the draft is empty: ${locale === "en" ? "English" : "French"}\n\n<draft>\n${body}\n</draft>\n\n${TASKS[mode](Boolean(body.trim()))}`,
      },
    ],
    { maxTokens: 2000 },
  );
}

/** One chat completion on Groq. Throws AiRefusedError when the model gives nothing usable. */
async function chat(messages, { maxTokens, json = false }) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(json ? 60_000 : 30_000),
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: maxTokens,
      reasoning_effort: "low",
      include_reasoning: false,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Groq ${res.status}: ${data.error?.message ?? "unknown error"}`);

  const choice = data.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  if (choice?.finish_reason === "content_filter" || !text) throw new AiRefusedError("empty");
  return text;
}

// "Revive this video" report (controllers/myChannel.js): what the creator can do
// on one of their own older videos to get it views again.
export const REVIVE_ACTION_TYPES = ["title", "thumbnail", "short", "pin", "playlist", "endscreen", "description", "community", "update"];
const PRIORITIES = ["high", "medium", "low"];

const REVIVE_SYSTEM = `You are a YouTube growth strategist. A creator asks how to bring one of their older videos back to life.
You receive the video (title, description excerpt, tags, format, age, views, its recent view pace compared to its lifetime pace),
its title/thumbnail history, the channel's usual views and best recent titles, and sometimes where its views come from (YouTube Analytics).
Give concrete, specific actions the creator can do today on THIS video, ranked by expected impact. Ground every action in the data;
when the video is already reviving, explain how to amplify it while it is hot. Never invent numbers you were not given.
Possible action types: ${REVIVE_ACTION_TYPES.join(", ")}
  title: a new title (give 2-3 ready-to-use titles in "examples", in the video's language)
  thumbnail: what to change on the thumbnail (text, face, contrast, subject), as a short brief
  short: a YouTube Short cut from the video that links to it (which moment or angle, hook line in "examples")
  pin: a comment to pin (give the comment text in "examples")
  playlist: which playlist to add it to or create, and where to place it
  endscreen: end screens / cards from newer related videos pointing to it
  description: description and chapters improvements for search
  community: a community post or story to push it
  update: remake or follow-up video if the topic is still in demand
Reply with JSON only, matching:
{"verdict": "reviving" | "steady" | "dormant", "summary": string (2 sentences max), "diagnosis": string (why it gets views now or why not, 3 sentences max),
 "actions": [{"type": one of the types, "priority": "high" | "medium" | "low", "title": string (short imperative), "detail": string (2-3 sentences), "examples": string[] (optional, max 3)}]}
Give 4 to 7 actions. Write every text in the requested language, except "examples" of titles, pinned comments and hook lines:
those are published on the video, so they stay in the video's language.`;

const clip = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Keeps only what the page can show: known types and priorities, bounded strings. */
function parseReport(text) {
  let raw;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AiRefusedError("invalid json");
  }
  const actions = (Array.isArray(raw.actions) ? raw.actions : [])
    .filter((a) => a && REVIVE_ACTION_TYPES.includes(a.type) && clip(a.title, 160))
    .slice(0, 8)
    .map((a) => ({
      type: a.type,
      priority: PRIORITIES.includes(a.priority) ? a.priority : "medium",
      title: clip(a.title, 160),
      detail: clip(a.detail, 700),
      examples: (Array.isArray(a.examples) ? a.examples : []).map((e) => clip(e, 220)).filter(Boolean).slice(0, 3),
    }));
  if (!actions.length) throw new AiRefusedError("no actions");
  return {
    verdict: ["reviving", "steady", "dormant"].includes(raw.verdict) ? raw.verdict : null,
    summary: clip(raw.summary, 500),
    diagnosis: clip(raw.diagnosis, 900),
    actions,
  };
}

/**
 * @param {{ locale: "fr" | "en", context: string }} input  context: the facts about the video, one per line
 * @returns {Promise<{ verdict: string | null, summary: string, diagnosis: string, actions: object[] }>}
 */
export async function reviveVideoReport({ locale, context }) {
  const text = await chat(
    [
      { role: "system", content: REVIVE_SYSTEM },
      {
        role: "user",
        content: `<facts>\n${context}\n</facts>\n\nRequested language: ${locale === "en" ? "English" : "French"}`,
      },
    ],
    { maxTokens: 4000, json: true },
  );
  return parseReport(text);
}
