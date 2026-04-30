import { NextRequest } from "next/server";
import {
  parseInput,
  generateExactDomains,
  expandWithTLDs,
} from "@/lib/name-generator";
import { generateAINames, generateNamesFromBusiness } from "@/lib/gemini";
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

export async function POST(request: NextRequest) {
  try {
    const { query, mode } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isBusinessMode = mode === "business";
    const trimmedQuery = query.trim();

    // In business mode we skip exact-match generation entirely — a long
    // business description doesn't make a useful exact domain.
    let baseName = "";
    if (!isBusinessMode) {
      const parsed = parseInput(trimmedQuery);
      baseName = parsed.baseName;
      if (!baseName) {
        return new Response(JSON.stringify({ error: "Invalid query" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let exactResults: DomainResult[] = [];

        if (!isBusinessMode) {
          // Phase 1: Exact match — fast DNS check
          const exactDomains = generateExactDomains(baseName);
          exactResults = await checkWithCache(exactDomains);

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "exact",
                baseName,
                results: exactResults,
              }) + "\n"
            )
          );
        } else {
          // Tell the client to skip straight to suggestions UI.
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "exact",
                baseName: "",
                results: [],
              }) + "\n"
            )
          );
        }

        // Phase 2: AI-powered suggestions
        const aiNames = isBusinessMode
          ? await generateNamesFromBusiness(trimmedQuery)
          : await generateAINames(trimmedQuery);

        const uniqueNames = aiNames.filter((name) => name !== baseName);
        const suggestionDomains = expandWithTLDs(uniqueNames);
        const suggestionResults = await checkWithCache(suggestionDomains);
        const sortedResults = sortByAvailability(suggestionResults);

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "suggestions",
              results: sortedResults,
              total: exactResults.length + sortedResults.length,
              available:
                exactResults.filter((r) => r.available).length +
                sortedResults.filter((r) => r.available).length,
            }) + "\n"
          )
        );

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
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
