import dns from "dns/promises";

// Per-TLD RDAP endpoints. Mostly from IANA's bootstrap registry
// (https://data.iana.org/rdap/dns.json), with overrides where the registry
// runs RDAP outside IANA's listing (Identity Digital serves .io and .ai).
//
// 200 = registered (taken), 404 = not registered (available).
// Other statuses map to "unknown" — better than guessing wrong, which was
// the original DNS-only bug (parked domains showed as available).
const RDAP_SERVERS: Record<string, string> = {
  ".com": "https://rdap.verisign.com/com/v1/domain/",
  ".net": "https://rdap.verisign.com/net/v1/domain/",
  ".org": "https://rdap.publicinterestregistry.org/rdap/domain/",
  ".io": "https://rdap.identitydigital.services/rdap/domain/",
  ".ai": "https://rdap.identitydigital.services/rdap/domain/",
  ".dev": "https://pubapi.registry.google/rdap/domain/",
  ".app": "https://pubapi.registry.google/rdap/domain/",
  ".xyz": "https://rdap.centralnic.com/xyz/domain/",
  ".tech": "https://rdap.radix.host/rdap/domain/",
  // .co has no public RDAP we can rely on; falls through to DNS.
};

// Google's RDAP throttles aggressively past ~10 concurrent requests.
// 8 leaves headroom; the others handle 12 without trouble.
const HOST_CONCURRENCY: Record<string, number> = {
  "pubapi.registry.google": 8,
};
const DEFAULT_HOST_CONCURRENCY = 12;

const TIMEOUT_MS = 4500;
const RETRY_DELAY_MS = 800;

export type DomainStatus = "available" | "taken" | "unknown";

export interface DomainResult {
  domain: string;
  status: DomainStatus;
}

function tldOf(domain: string): string {
  const idx = domain.indexOf(".");
  return idx === -1 ? "" : domain.slice(idx);
}

function hostOf(url: string): string {
  return new URL(url).host;
}

// DNS as a positive-only signal: if DNS records exist, the domain is
// registered. If DNS doesn't resolve we return "unknown" rather than
// "available" — parked / inactive registered domains wouldn't resolve.
async function dnsFallback(domain: string): Promise<DomainStatus> {
  try {
    await dns.resolve(domain);
    return "taken";
  } catch {
    return "unknown";
  }
}

async function rdapFetchOnce(
  base: string,
  domain: string
): Promise<{ status: DomainStatus; httpCode: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(base + encodeURIComponent(domain), {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/rdap+json" },
    });
    if (res.status === 404) return { status: "available", httpCode: 404 };
    if (res.status === 200) return { status: "taken", httpCode: 200 };
    return { status: "unknown", httpCode: res.status };
  } catch {
    return { status: "unknown", httpCode: 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function checkSingleDomain(domain: string): Promise<DomainResult> {
  const tld = tldOf(domain);
  const base = RDAP_SERVERS[tld];

  if (!base) {
    return { domain, status: await dnsFallback(domain) };
  }

  let attempt = await rdapFetchOnce(base, domain);
  if (attempt.httpCode === 429) {
    // Rate-limited — back off briefly and try once more.
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    attempt = await rdapFetchOnce(base, domain);
  }
  return { domain, status: attempt.status };
}

// Per-host semaphore: each registry server has its own in-flight cap so we
// can run high overall throughput without crushing any one server.
function makeHostLimiter() {
  const inFlight = new Map<string, number>();
  const queues = new Map<string, Array<() => void>>();

  const limitFor = (host: string) =>
    HOST_CONCURRENCY[host] ?? DEFAULT_HOST_CONCURRENCY;

  async function acquire(host: string): Promise<void> {
    while ((inFlight.get(host) ?? 0) >= limitFor(host)) {
      await new Promise<void>((resolve) => {
        const q = queues.get(host) ?? [];
        q.push(resolve);
        queues.set(host, q);
      });
    }
    inFlight.set(host, (inFlight.get(host) ?? 0) + 1);
  }

  function release(host: string): void {
    inFlight.set(host, Math.max(0, (inFlight.get(host) ?? 1) - 1));
    const q = queues.get(host);
    if (q && q.length > 0) {
      const next = q.shift()!;
      next();
    }
  }

  return { acquire, release };
}

export async function checkDomains(
  domains: string[],
  onResult?: (result: DomainResult) => void
): Promise<DomainResult[]> {
  const limiter = makeHostLimiter();

  return Promise.all(
    domains.map(async (domain) => {
      const tld = tldOf(domain);
      const base = RDAP_SERVERS[tld];

      let result: DomainResult;
      if (!base) {
        // DNS fallback path doesn't need an HTTP slot.
        result = await checkSingleDomain(domain);
      } else {
        const host = hostOf(base);
        await limiter.acquire(host);
        try {
          result = await checkSingleDomain(domain);
        } finally {
          limiter.release(host);
        }
      }

      onResult?.(result);
      return result;
    })
  );
}
