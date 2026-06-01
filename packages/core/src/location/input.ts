export interface LocationMethodInput {
  method: "location";
  countryCode: string;
  postalCode?: string;
  level1?: string;
  level2?: string;
  level3?: string;
  level4?: string;
}

/** Future-safe member; not accepted by the v0.1 HTTP API. */
export interface CoordinateInput {
  method: "coordinate";
  latitude: number;
  longitude: number;
}

/** Public v0.1 request shape (location method only). */
export type LocationInput = LocationMethodInput;

export type LocationInputUnion = LocationMethodInput | CoordinateInput;

const LEVEL_KEYS = ["level1", "level2", "level3", "level4"] as const;

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertHierarchyPrefix(
  input: Record<string, unknown>,
  field: string,
): void {
  for (let index = 1; index < LEVEL_KEYS.length; index += 1) {
    const key = LEVEL_KEYS[index]!;
    const parentKey = LEVEL_KEYS[index - 1]!;
    if (hasNonEmptyString(input[key]) && !hasNonEmptyString(input[parentKey])) {
      throw new LocationValidationError(
        `${field}.${key} requires ${field}.${parentKey}`,
      );
    }
  }
}

export class LocationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationValidationError";
  }
}

export function validateLocationInput(
  value: unknown,
  field: string,
): LocationMethodInput {
  if (value === null || typeof value !== "object") {
    throw new LocationValidationError(`${field} must be an object`);
  }

  const raw = value as Record<string, unknown>;

  if (raw.method !== "location") {
    if (raw.method === "coordinate") {
      throw new LocationValidationError(
        `${field}: coordinate input is not supported in API v0.1; use method "location"`,
      );
    }
    throw new LocationValidationError(
      `${field}.method must be "location" in API v0.1`,
    );
  }

  if (!hasNonEmptyString(raw.countryCode)) {
    throw new LocationValidationError(`${field}.countryCode is required`);
  }

  assertHierarchyPrefix(raw, field);

  const hasPostal = hasNonEmptyString(raw.postalCode);
  const hasLevel1 = hasNonEmptyString(raw.level1);
  const hasLevel2 = hasNonEmptyString(raw.level2);

  if (!hasPostal && !(hasLevel1 && hasLevel2)) {
    throw new LocationValidationError(
      `${field} must include postalCode or both level1 and level2`,
    );
  }

  const normalized: LocationMethodInput = {
    method: "location",
    countryCode: raw.countryCode.trim().toUpperCase(),
  };

  if (hasPostal && typeof raw.postalCode === "string") {
    normalized.postalCode = raw.postalCode.trim();
  }
  for (const key of LEVEL_KEYS) {
    const levelValue = raw[key];
    if (hasNonEmptyString(levelValue)) {
      normalized[key] = levelValue.trim();
    }
  }

  return normalized;
}
