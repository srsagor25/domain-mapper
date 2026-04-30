import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function sanitizeNames(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter((name) => name.length >= 3 && name.length <= 16);
}

export async function generateAINames(seed: string): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are the world's best domain name strategist — the person startups pay $10,000 to name their company.

Someone is searching for: "${seed}"

Your job:
1. First, understand the INTENT. Why does someone want "${seed}" as a domain? What are they building? What vibe, industry, or concept are they going for?
2. Then generate 30 domain name alternatives that someone would ACTUALLY pick as their brand name.

Think like a founder choosing their company name. The name needs to:
- Sound like a real company (not a keyword mashup)
- Be memorable — someone hears it once and remembers it
- Feel modern and brandable
- Capture the same energy/concept as "${seed}"

Strategies to use (mix all of these):
- Portmanteaus: blend two relevant words into one new word (like Spotify = spot + identify, Pinterest = pin + interest)
- Phonetic plays: change spelling to create something fresh (like Lyft, Fiverr, Tumblr)
- Metaphors: use a word from a different domain that captures the same feeling (like Amazon = vast, Slack = easy)
- Short compound words: two small words merged naturally (like Airbnb, YouTube, Snapchat)
- Invented words: completely new words that sound good and feel right (like Kodak, Xerox, Hulu)
- Cultural/mythological references: names with deeper meaning (like Nike, Pandora, Atlas)

DO NOT:
- Use generic prefixes like "get", "try", "use", "my", "the", "go"
- Use generic suffixes like "hub", "base", "kit", "nest", "box", "pad"
- Just append "ai", "app", "lab", "hq" to the original word
- Generate names that sound like placeholder URLs

Return ONLY the names, one per line. No numbering, no TLDs, no explanations, no categories.`;

    const result = await model.generateContent(prompt);
    return sanitizeNames(result.response.text());
  } catch (error) {
    console.error("Gemini API error:", error);
    return [];
  }
}

export async function generateNamesFromBusiness(
  description: string
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are the world's best domain name strategist — the person startups pay $10,000 to name their company.

Here is the business idea / offer:
"""
${description}
"""

Your job:
1. Read carefully. Identify the audience, the value proposition, the industry, and the emotional hook.
2. Then generate 40 brandable domain name candidates that a founder would actually use as their company name.

The names need to:
- Sound like a real company (not a keyword mashup or SEO slug)
- Be short (ideally 4–12 characters), memorable, and easy to say out loud
- Feel modern, ownable, and on-brand for the described business
- Avoid literal descriptions of the offer — aim for evocative, not explanatory

Strategies to mix:
- Portmanteaus: blend two relevant words into one (Spotify = spot + identify, Pinterest = pin + interest)
- Phonetic plays: tweak spelling for freshness (Lyft, Fiverr, Tumblr)
- Metaphors: borrow a word from another domain that captures the feeling (Amazon = vast, Slack = ease)
- Short compounds: two small words merged naturally (Airbnb, YouTube, Snapchat)
- Invented words: brand-new words that sound right (Kodak, Xerox, Hulu)
- Cultural / mythological references: names with deeper meaning (Nike, Pandora, Atlas)

DO NOT:
- Use generic prefixes like "get", "try", "use", "my", "the", "go"
- Use generic suffixes like "hub", "base", "kit", "nest", "box", "pad"
- Just append "ai", "app", "lab", "hq" to a keyword from the description
- Generate names that read like ad copy or SEO phrases

Return ONLY the names, one per line. No numbering, no TLDs, no explanations, no categories.`;

    const result = await model.generateContent(prompt);
    return sanitizeNames(result.response.text());
  } catch (error) {
    console.error("Gemini API error:", error);
    return [];
  }
}
