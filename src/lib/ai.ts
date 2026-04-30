import OpenAI from "openai";

// OpenRouter exposes an OpenAI-compatible API.
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer":
      process.env.OPENROUTER_REFERER || "https://domain-mapper-lovat.vercel.app",
    "X-Title": "Domain Mapper",
  },
});

// OpenRouter free-tier model. Override with OPENROUTER_MODEL if needed.
const MODEL =
  process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

export class AIError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}

const SYSTEM_PROMPT = `You are the world's best domain name strategist — the person startups pay $10,000 to name their company.

Generate brandable company names that founders would actually use. Each name should:
- Sound like a real company (not a keyword mashup or SEO slug)
- Be short (4–12 chars), memorable, easy to say out loud
- Feel modern, ownable, and on-brand
- Be a single token — letters and numbers only, no spaces, no punctuation, no TLDs

Strategies to mix across the list:
- Portmanteaus: blend two relevant words (Spotify, Pinterest)
- Phonetic plays: tweak spelling for freshness (Lyft, Fiverr, Tumblr)
- Metaphors: borrow a word that captures the feeling (Amazon, Slack)
- Short compounds: two small words merged (Airbnb, YouTube)
- Invented words: brand-new but pronounceable (Kodak, Xerox, Hulu)
- Cultural / mythological references (Nike, Pandora, Atlas)

DO NOT use generic prefixes ("get", "try", "use", "my", "the", "go").
DO NOT use generic suffixes ("hub", "base", "kit", "nest", "box", "pad").
DO NOT just append "ai", "app", "lab", "hq" to a keyword.
DO NOT generate names that read like ad copy or SEO phrases.

Output format: one name per line. No numbering, no TLDs, no explanations, no headings.`;

// Reject lines with multiple words (preambles like "Here are 30 names:") before sanitizing,
// so model chatter doesn't slip through as a "domain name".
function sanitizeNames(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.split(/\s+/).length === 1)
    .map((line) => line.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((name) => name.length >= 3 && name.length <= 16);
}

async function callModel(userPrompt: string): Promise<string[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new AIError(
      "Server is missing OPENROUTER_API_KEY. Contact the administrator.",
      503
    );
  }

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.9,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    return sanitizeNames(text);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const status = e.status ?? 500;
    const msg = (e.message || "").toLowerCase();

    let message: string;
    if (status === 401 || status === 403) {
      message = "Server's OpenRouter key is invalid. Contact the administrator.";
    } else if (status === 429 || msg.includes("rate") || msg.includes("quota")) {
      message =
        "OpenRouter rate limit hit. Free-tier models share quota — try again in a moment.";
    } else {
      message = "Failed to generate names. Please try again.";
    }
    throw new AIError(message, status);
  }
}

export function generateAINames(seed: string): Promise<string[]> {
  return callModel(
    `Someone is searching for the domain "${seed}". Infer the intent — what they're building, the vibe, the industry — and generate 30 alternative brand names that capture the same energy.`
  );
}

export function generateNamesFromBusiness(
  description: string
): Promise<string[]> {
  return callModel(
    `Here is the business idea / offer:\n"""\n${description}\n"""\n\nIdentify the audience, value proposition, industry, and emotional hook. Then generate 40 brandable name candidates a founder would actually use as their company name.`
  );
}
