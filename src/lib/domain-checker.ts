import dns from "dns/promises";

export interface DomainResult {
  domain: string;
  available: boolean;
}

async function checkSingleDomain(domain: string): Promise<DomainResult> {
  try {
    await dns.resolve(domain);
    return { domain, available: false };
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "SERVFAIL") {
      return { domain, available: true };
    }
    // Network error or timeout — mark as unknown/unavailable
    return { domain, available: false };
  }
}

export async function checkDomains(
  domains: string[]
): Promise<DomainResult[]> {
  // Check all domains in parallel for speed
  const results = await Promise.all(domains.map(checkSingleDomain));
  return results;
}
