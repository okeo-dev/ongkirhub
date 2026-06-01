import { LocationError } from "./errors.js";
import type { LocationMethodInput } from "./input.js";
import type { ProviderLocationRecord } from "./records.js";
import {
  MIN_RESOLUTION_SCORE,
  pickBestScoredCandidates,
  scoreLocationCandidates,
  type ScoredLocationRecord,
} from "./scoring.js";

export interface LocationResolverOptions {
  providerKey?: string;
  minScore?: number;
}

export interface LocationResolution {
  record: ProviderLocationRecord;
  score: number;
}

export function resolveLocation(
  input: LocationMethodInput,
  records: ProviderLocationRecord[],
  options: LocationResolverOptions = {},
): LocationResolution {
  const providerKey = options.providerKey;

  if (records.length === 0) {
    throw new LocationError(
      "LOCATION_RESOLVER_NOT_CONFIGURED",
      "No location mapping records are configured for this provider",
      { providerKey },
    );
  }

  const countryRecords = records.filter(
    (record) => record.countryCode === input.countryCode,
  );

  if (countryRecords.length === 0) {
    throw new LocationError(
      "LOCATION_NOT_FOUND",
      `No location records found for country ${input.countryCode}`,
      { providerKey },
    );
  }

  try {
    const scored = scoreLocationCandidates(input, countryRecords);
    const minScore = options.minScore ?? MIN_RESOLUTION_SCORE;
    const viable = scored.filter((candidate) => candidate.score >= minScore);

    if (viable.length === 0) {
      throw new LocationError(
        "LOCATION_NOT_FOUND",
        "No location candidate matched the input at acceptable confidence",
        { providerKey },
      );
    }

    const best = pickBestScoredCandidates(viable);

    if (best.length > 1) {
      throw new LocationError(
        "LOCATION_AMBIGUOUS",
        `Multiple location candidates tied at score ${best[0]!.score}`,
        { providerKey },
      );
    }

    const winner = best[0]!;
    return {
      record: winner.record,
      score: winner.score,
    };
  } catch (error) {
    if (error instanceof LocationError) {
      throw error;
    }
    throw new LocationError(
      "LOCATION_RESOLUTION_FAILED",
      "Location resolution failed",
      { providerKey, cause: error },
    );
  }
}

export function resolveLocationOrNull(
  input: LocationMethodInput,
  records: ProviderLocationRecord[],
  options?: LocationResolverOptions,
): ScoredLocationRecord | null {
  try {
    const result = resolveLocation(input, records, options);
    return { record: result.record, score: result.score };
  } catch (error) {
    if (
      error instanceof LocationError &&
      (error.code === "LOCATION_NOT_FOUND" ||
        error.code === "LOCATION_AMBIGUOUS")
    ) {
      return null;
    }
    throw error;
  }
}
