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

const DISTRICT_LEVEL = 3 as const;
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

function pickDistrictCandidate(
  candidates: ScoredLocationRecord[],
): ProviderLocationRecord {
  const districts = candidates.filter(
    (candidate) => candidate.record.level === DISTRICT_LEVEL,
  );

  if (districts.length === 0) {
    throw new LocationError(
      "LOCATION_NOT_FOUND",
      "Input did not resolve to a unique RajaOngkir district",
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  const best = pickBestScoredCandidates(districts);

  if (best.length > 1) {
    throw new LocationError(
      "LOCATION_AMBIGUOUS",
      `Multiple RajaOngkir districts tied at score ${best[0]!.score}`,
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  return best[0]!.record;
}

function resolveDistrictFromPostal(
  input: LocationMethodInput,
  records: ProviderLocationRecord[],
): ProviderLocationRecord | null {
  if (!input.postalCode) {
    return null;
  }

  const normalizedPostal = normalizePostalCode(input.postalCode);
  const postalDistricts = records.filter(
    (record) =>
      record.level === DISTRICT_LEVEL &&
      record.postalCodes.includes(normalizedPostal),
  );

  if (postalDistricts.length === 0) {
    return null;
  }

  const hierarchyMatches = postalDistricts.filter((district) =>
    inputMatchesDistrictPath(input, district, records),
  );

  if (hierarchyMatches.length === 1) {
    return hierarchyMatches[0]!;
  }

  if (hierarchyMatches.length > 1) {
    throw new LocationError(
      "LOCATION_AMBIGUOUS",
      `Postal code ${input.postalCode} matches multiple RajaOngkir districts`,
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

  if (postalDistricts.length === 1) {
    return postalDistricts[0]!;
  }

  const scored = scoreLocationCandidates(input, records).filter((candidate) =>
    postalDistricts.some(
      (district) => district.providerId === candidate.record.providerId,
    ),
  );

  if (scored.length === 0) {
    throw new LocationError(
      "LOCATION_AMBIGUOUS",
      `Postal code ${input.postalCode} matches multiple RajaOngkir districts`,
      { providerKey: RAJAONGKIR_PROVIDER_KEY },
    );
  }

  return pickDistrictCandidate(scored);
}

export function resolveDistrict(
  input: LocationMethodInput,
  records: ProviderLocationRecord[],
): ProviderLocationRecord {
  try {
    const postalMatch = resolveDistrictFromPostal(input, records);
    if (postalMatch) {
      return postalMatch;
    }

    const resolution = resolveLocation(input, records, {
      providerKey: RAJAONGKIR_PROVIDER_KEY,
    });

    if (resolution.record.level !== DISTRICT_LEVEL) {
      throw new LocationError(
        "LOCATION_NOT_FOUND",
        "Input did not resolve to a unique RajaOngkir district",
        { providerKey: RAJAONGKIR_PROVIDER_KEY },
      );
    }

    if (resolution.score < MIN_RESOLUTION_SCORE) {
      throw new LocationError(
        "LOCATION_NOT_FOUND",
        "District resolution score was below acceptable confidence",
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
