/** Deterministic token normalization for location matching. */
export function normalizeLocationToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizePostalCode(value: string): string {
  return normalizeLocationToken(value).replace(/\s/g, "");
}
