import { NextRequest } from "next/server";
import {
  parseInput,
  generateExactDomains,
  expandWithTLDs,
} from "@/lib/name-generator";
import {
  generateAINames,
  generateNamesFromBusiness,
  AIKeyError,
  isProvider,
} from "@/lib/ai";
import { checkDomains, DomainResult } from "@/lib/domain-checker";

// In-memory cache (24h TTL)
const cache = new Map<string, { result: DomainResult; expires: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCached(domain: string): DomainResult | null {
  const entry = cache.get(domain);
  if (entry && entry.expires > Date.now()) return entry.result;
  cache.delete(domain);
  return null;
}

function setCache(result: DomainResult) {
  cache.set(result.domain, { result, expires: Date.now() + CACHE_TTL });
}

async function checkWithCache(domains: string[]): Promise<DomainResult[]> {
  const unchecked: string[] = [];
  const cachedResults: DomainResult[] = [];

  for (const domain of domains) {
    const cached = getCached(domain);
    if (cached) {
      cachedResults.push(cached);
    } else {
      unchecked.push(domain);
    }
  }

  const freshResults = await checkDomains(unchecked);
  for (const result of freshResults) setCache(result);

  return [...cachedResults, ...freshResults];
}

function sortByAvailability(results: DomainResult[]): DomainResult[] {
  const grouped = new Map<string, DomainResult[]>();
  for (const result of results) {
    const dotIndex = result.domain.indexOf(".");
    const name = result.domain.slice(0, dotIndex);
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(result);
  }

  const sortedGroups = Array.from(grouped.entries()).sort(
    ([, aResults], [, bResults]) => {
      const aComAvail =
        aResults.find((r) => r.domain.endsWith(".com"))?.available ?? false;
      const bComAvail =
        bResults.find((r) => r.domain.endsWith(".com"))?.available ?? false;
      if (aComAvail !== bComAvail) return aComAvail ? -1 : 1;

      const aAvailCount = aResults.filter((r) => r.available).length;
      const bAvailCount = bResults.filter((r) => r.available).length;
      return bAvailCount - aAvailCount;
    }
  );

  return sortedGroups.flatMap(([, results]) => results);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const providerHeader = request.headers.get("x-ai-provider")?.trim();
    if (!providerHeader || !isProvider(providerHeader)) {
      return jsonError(
        "Missing or invalid AI provider. Choose OpenAI, Anthropic, or Google in the app.",
        400
      );
    }
    const provider = providerHeader;

    const apiKey = request.headers.get("x-api-key")?.trim();
    if (!apiKey) {
      return jsonError(
        "Missing API key. Add your provider key in the app to continue.",
        401
      );
    }

    const expectedPrefix =
      provider === "openai"
        ? "sk-"
        : provider === "anthropic"
          ? "sk-ant-"
          : "AIza";
    if (!apiKey.startsWith(expectedPrefix)) {
      return jsonError(
        `${provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Google"} API keys should start with '${expectedPrefix}'. Please check the value.`,
        400
      );
    }

    const { query, mode } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return jsonError("Query is required", 400);
    }

    const isBusinessMode = mode === "business";
    const trimmedQuery = query.trim();

    let baseName = "";
    if (!isBusinessMode) {
      const parsed = parseInput(trimmedQuery);
      baseName = parsed.baseName;
      if (!baseName) return jsonError("Invalid query", 400);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
        };

        let exactResults: DomainResult[] = [];

        if (!isBusinessMode) {
          const exactDomains = generateExactDomains(baseName);
          exactResults = await checkWithCache(exactDomains);
          send({ type: "exact", baseName, results: exactResults });
        } else {
          send({ type: "exact", baseName: "", results: [] });
        }

        let aiNames: string[] = [];
        try {
          aiNames = isBusinessMode
            ? await generateNamesFromBusiness(trimmedQuery, provider, apiKey)
            : await generateAINames(trimmedQuery, provider, apiKey);
        } catch (err) {
          const message =
            err instanceof AIKeyError
              ? err.message
              : "Failed to generate names. Please try again.";
          send({ type: "error", message });
          controller.close();
          return;
        }

        const uniqueNames = aiNames.filter((name) => name !== baseName);
        const suggestionDomains = expandWithTLDs(uniqueNames);
        const suggestionResults = await checkWithCache(suggestionDomains);
        const sortedResults = sortByAvailability(suggestionResults);

        send({
          type: "suggestions",
          results: sortedResults,
          total: exactResults.length + sortedResults.length,
          available:
            exactResults.filter((r) => r.available).length +
            sortedResults.filter((r) => r.available).length,
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch {
    return jsonError("Internal server error", 500);
  }
}
