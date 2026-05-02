const TLDS = [
  ".com",
  ".ai",
  ".io",
  ".dev",
  ".app",
  ".co",
  ".xyz",
  ".tech",
  ".studio",
  ".agency",
];

/**
 * Parse user input to extract the base name and detect TLD.
 * "AI unicorn.com" → { baseName: "aiunicorn", requestedTld: ".com" }
 * "rocket"         → { baseName: "rocket", requestedTld: null }
 */
export function parseInput(raw: string): {
  baseName: string;
  requestedTld: string | null;
} {
  const trimmed = raw.trim().toLowerCase();

  let requestedTld: string | null = null;
  let withoutTld = trimmed;

  for (const tld of TLDS) {
    if (trimmed.endsWith(tld)) {
      requestedTld = tld;
      withoutTld = trimmed.slice(0, -tld.length);
      break;
    }
  }

  const baseName = withoutTld.replace(/[^a-z0-9]/g, "");

  return { baseName, requestedTld };
}

/**
 * Generate exact match domains — the base name across all TLDs.
 */
export function generateExactDomains(baseName: string): string[] {
  if (!baseName) return [];
  return TLDS.map((tld) => `${baseName}${tld}`);
}

export function expandWithTLDs(names: string[]): string[] {
  const domains: string[] = [];
  for (const name of names) {
    for (const tld of TLDS) {
      domains.push(`${name}${tld}`);
    }
  }
  return domains;
}

export { TLDS };
