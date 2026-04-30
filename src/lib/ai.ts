import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type Provider = "openai" | "anthropic" | "google";

export const PROVIDERS: Provider[] = ["openai", "anthropic", "google"];

export function isProvider(v: unknown): v is Provider {
  return v === "openai" || v === "anthropic" || v === "google";
}

const PROVIDER_MODEL: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.0-flash",
};

const PROVIDER_NAME: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
};

export class AIKeyError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AIKeyError";
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

async function callOpenAI(apiKey: string, userPrompt: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: PROVIDER_MODEL.openai,
    temperature: 0.9,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  return completion.choices[0]?.message?.content ?? "";
}

async function callAnthropic(apiKey: string, userPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: PROVIDER_MODEL.anthropic,
    max_tokens: 1024,
    temperature: 0.9,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

async function callGoogle(apiKey: string, userPrompt: string): Promise<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: PROVIDER_MODEL.google,
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.9 },
  });
  return result.response.text();
}

async function callProvider(
  provider: Provider,
  apiKey: string,
  userPrompt: string
): Promise<string[]> {
  try {
    let text: string;
    if (provider === "openai") text = await callOpenAI(apiKey, userPrompt);
    else if (provider === "anthropic") text = await callAnthropic(apiKey, userPrompt);
    else text = await callGoogle(apiKey, userPrompt);
    return sanitizeNames(text);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const msg = (e.message || "").toLowerCase();
    const name = PROVIDER_NAME[provider];

    let message: string;
    if (
      e.status === 401 ||
      e.status === 403 ||
      msg.includes("api_key_invalid") ||
      msg.includes("api key not valid") ||
      msg.includes("invalid api key") ||
      msg.includes("incorrect api key")
    ) {
      message = `Invalid ${name} API key. Double-check the key and try again.`;
    } else if (
      e.status === 429 ||
      msg.includes("rate limit") ||
      msg.includes("quota")
    ) {
      message = `${name} rate limit or quota exceeded for your key.`;
    } else {
      message = e.message
        ? `${name} request failed: ${e.message}`
        : `${name} request failed.`;
    }
    throw new AIKeyError(message, e.status ?? 500);
  }
}

export function generateAINames(
  seed: string,
  provider: Provider,
  apiKey: string
): Promise<string[]> {
  return callProvider(
    provider,
    apiKey,
    `Someone is searching for the domain "${seed}". Infer the intent — what they're building, the vibe, the industry — and generate 30 alternative brand names that capture the same energy.`
  );
}

export function generateNamesFromBusiness(
  description: string,
  provider: Provider,
  apiKey: string
): Promise<string[]> {
  return callProvider(
    provider,
    apiKey,
    `Here is the business idea / offer:\n"""\n${description}\n"""\n\nIdentify the audience, value proposition, industry, and emotional hook. Then generate 40 brandable name candidates a founder would actually use as their company name.`
  );
}
