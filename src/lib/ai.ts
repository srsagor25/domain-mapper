import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "gpt-4o-mini";

function sanitizeNames(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((name) => name.length >= 3 && name.length <= 16);
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

export async function generateAINames(seed: string): Promise<string[]> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.9,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Someone is searching for the domain "${seed}". Infer the intent — what they're building, the vibe, the industry — and generate 30 alternative brand names that capture the same energy.`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return sanitizeNames(text);
  } catch (error) {
    console.error("OpenAI API error (generateAINames):", error);
    return [];
  }
}

export async function generateNamesFromBusiness(
  description: string
): Promise<string[]> {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.9,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is the business idea / offer:\n"""\n${description}\n"""\n\nIdentify the audience, value proposition, industry, and emotional hook. Then generate 40 brandable name candidates a founder would actually use as their company name.`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return sanitizeNames(text);
  } catch (error) {
    console.error("OpenAI API error (generateNamesFromBusiness):", error);
    return [];
  }
}
