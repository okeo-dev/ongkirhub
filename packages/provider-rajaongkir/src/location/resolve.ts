import {
  LocationError,
  MIN_RESOLUTION_SCORE,
  normalizeLocationToken,
  normalizePostalCode,
  pickBestScoredCandidates,
  ProviderError,
  resolveLocation,
  scoreLocationCandidates,
  type LocationMethodInput,
  type ProviderLocationRecord,
  type ScoredLocationRecord,
} from "@ongkirhub/core";

export const RAJAONGKIR_PROVIDER_KEY = "rajaongkir";

const LEAF_LEVEL = 4 as const;
const LEVEL_KEYS = ["level1", "level2", "level3", "level4"] as const;

function indexRecords(
  records: ProviderLocationRecord[],
): Map<string, ProviderLocationRecord> {
  return new Map(records.map((record) => [record.providerId, record]));
}

function getAncestorAtLevel(
  record: ProviderLocationRecord,
  targetLevel: number,
  recordsByProviderId: Map<string, ProviderLocationRecord>,
): ProviderLocationRecord | undefined {
  let current: ProviderLocationRecord | undefined = record;
  while (current && current.level > targetLevel) {
    if (!current.parentProviderId) {
      return undefined;
    }
    current = recordsByProviderId.get(current.parentProviderId);
  }
  return current?.level === targetLevel ? current : undefined;
}

function nameMatches(
  record: ProviderLocationRecord,
  normalizedTarget: string,
): boolean {
  return (
    record.normalizedName === normalizedTarget ||
    record.normalizedAliases.includes(normalizedTarget)
  );
}

function inputMatchesDistrictPath(
  input: LocationMethodInput,
  district: ProviderLocationRecord,
  records: ProviderLocationRecord[],
): boolean {
  const recordsByProviderId = indexRecords(records);

  for (const key of LEVEL_KEYS) {
    const inputValue = input[key];
    if (!inputValue) {
      continue;
    }

    const level = Number(key.replace("level", ""));
    const ancestor =
      getAncestorAtLevel(district, level, recordsByProviderId) ??
      (district.level === level ? district : undefined);

    if (!ancestor) {
      return false;
    }

    if (!nameMatches(ancestor, normalizeLocationToken(inputValue))) {
      return false;
    }
  }

  return true;
}

function hasHierarchyHints(input: LocationMethodInput): boolean {
  return LEVEL_KEYS.some((key) => Boolean(input[key]));
}

function pickLeafCandidate(
  candidates: ScoredLocationRecord[],
): ProviderLocationRecord {
  const leaves = candidates.filter(
    (candidate) => candidate.record.level === LEAF_LEVEL,
  );

  if (leaves.length === 0) {
    throw new LocationError(
      "LOCATION_NOT_FOUND",
      "Input did not resolve to a unique RajaOngkir subdistrict",
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  const best = pickBestScoredCandidates(leaves);

  if (best.length > 1) {
    throw new LocationError(
      "LOCATION_AMBIGUOUS",
      `Multiple RajaOngkir subdistricts tied at score ${best[0]!.score}`,
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  return best[0]!.record;
}

function resolveLeafFromPostal(
  input: LocationMethodInput,
  records: ProviderLocationRecord[],
): ProviderLocationRecord | null {
  if (!input.postalCode) {
    return null;
  }

  const normalizedPostal = normalizePostalCode(input.postalCode);
  const postalLeaves = records.filter(
    (record) =>
      record.level === LEAF_LEVEL &&
      record.postalCodes.includes(normalizedPostal),
  );

  if (postalLeaves.length === 0) {
    return null;
  }

  const hierarchyMatches = postalLeaves.filter((leaf) =>
    inputMatchesDistrictPath(input, leaf, records),
  );

  if (hierarchyMatches.length === 1) {
    return hierarchyMatches[0]!;
  }

  if (hierarchyMatches.length > 1) {
    throw new LocationError(
      "LOCATION_AMBIGUOUS",
      `Postal code ${input.postalCode} matches multiple RajaOngkir subdistricts`,
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  if (hierarchyMatches.length === 0 && hasHierarchyHints(input)) {
    throw new LocationError(
      "LOCATION_NOT_FOUND",
      "Postal code does not match the supplied location hierarchy",
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  if (postalLeaves.length === 1) {
    return postalLeaves[0]!;
  }

  const scored = scoreLocationCandidates(input, records).filter((candidate) =>
    postalLeaves.some(
      (leaf) => leaf.providerId === candidate.record.providerId,
    ),
  );

  if (scored.length === 0) {
    throw new LocationError(
      "LOCATION_AMBIGUOUS",
      `Postal code ${input.postalCode} matches multiple RajaOngkir subdistricts`,
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  return pickLeafCandidate(scored);
}

/**
 * Strip the internal provider-id prefix so the raw RajaOngkir numeric id
 * can be sent to upstream API endpoints.
 */
export function extractRajaOngkirApiId(providerId: string): string {
  return providerId.replace(/^[pcds]/, "");
}

export function resolveDistrict(
  input: LocationMethodInput,
  records: ProviderLocationRecord[],
): ProviderLocationRecord {
  try {
    const postalMatch = resolveLeafFromPostal(input, records);
    if (postalMatch) {
      return postalMatch;
    }

    const resolution = resolveLocation(input, records, {
      providerKey: RAJAONGKIR_PROVIDER_KEY,
    });

    if (resolution.record.level !== LEAF_LEVEL) {
      throw new LocationError(
        "LOCATION_NOT_FOUND",
        "Input did not resolve to a unique RajaOngkir subdistrict",
        { providerKey: RAJAONGKIR_PROVIDER_KEY },
      );
    }

    if (resolution.score < MIN_RESOLUTION_SCORE) {
      throw new LocationError(
        "LOCATION_NOT_FOUND",
        "Subdistrict resolution score was below acceptable confidence",
        { providerKey: RAJAONGKIR_PROVIDER_KEY },
      );
    }

    return resolution.record;
  } catch (error) {
    if (error instanceof LocationError) {
      throw new ProviderError(error.code, error.message, {
        providerKey: RAJAONGKIR_PROVIDER_KEY,
        cause: error,
      });
    }
    throw error;
  }
}
