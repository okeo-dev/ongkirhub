import type { LocationMethodInput } from "./input.js";
import { normalizeLocationToken, normalizePostalCode } from "./normalize.js";
import type { ProviderLocationRecord } from "./records.js";

export const MIN_RESOLUTION_SCORE = 50;

export interface ScoredLocationRecord {
  record: ProviderLocationRecord;
  score: number;
}

const LEVEL_KEYS = ["level1", "level2", "level3", "level4"] as const;

function inputLevels(input: LocationMethodInput): string[] {
  return LEVEL_KEYS.map((key) => input[key]).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
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

function pathLevelMatchesInput(
  inputValue: string,
  pathValue: string,
  ancestorRecord: ProviderLocationRecord | undefined,
): boolean {
  const normalizedInput = normalizeLocationToken(inputValue);
  if (normalizeLocationToken(pathValue) === normalizedInput) {
    return true;
  }
  if (ancestorRecord && nameMatches(ancestorRecord, normalizedInput)) {
    return true;
  }
  return false;
}

function pathMatchesInput(
  record: ProviderLocationRecord,
  input: LocationMethodInput,
  recordsByProviderId: Map<string, ProviderLocationRecord>,
): boolean {
  for (const key of LEVEL_KEYS) {
    const inputValue = input[key];
    if (!inputValue) {
      continue;
    }
    const pathValue = record.path[key];
    if (!pathValue) {
      return false;
    }
    const level = Number(key.replace("level", "")) as ProviderLocationRecord["level"];
    const ancestorRecord = getAncestorAtLevel(record, level, recordsByProviderId);
    if (!pathLevelMatchesInput(inputValue, pathValue, ancestorRecord)) {
      return false;
    }
  }
  return true;
}

function deepestInputLevel(input: LocationMethodInput): number {
  if (input.level4) return 4;
  if (input.level3) return 3;
  if (input.level2) return 2;
  if (input.level1) return 1;
  return 0;
}

function nameMatches(
  record: ProviderLocationRecord,
  normalizedTarget: string,
): boolean {
  if (record.normalizedName === normalizedTarget) {
    return true;
  }
  return record.normalizedAliases.includes(normalizedTarget);
}

export function scoreLocationRecord(
  input: LocationMethodInput,
  record: ProviderLocationRecord,
  recordsByProviderId: Map<string, ProviderLocationRecord>,
): number {
  if (record.countryCode !== input.countryCode) {
    return 0;
  }

  let score = 0;
  const levels = inputLevels(input);
  const deepest = deepestInputLevel(input);

  if (input.postalCode) {
    const normalizedPostal = normalizePostalCode(input.postalCode);
    if (record.postalCodes.includes(normalizedPostal)) {
      score += 40;
    }
  }

  if (levels.length > 0) {
    if (!pathMatchesInput(record, input, recordsByProviderId)) {
      return 0;
    }

    score += 20;

    const deepestInput = levels.at(-1);
    if (!deepestInput) {
      return 0;
    }
    const normalizedDeepest = normalizeLocationToken(deepestInput);

    if (record.level === deepest && nameMatches(record, normalizedDeepest)) {
      score += 50;
    } else if (nameMatches(record, normalizedDeepest)) {
      score += 30;
    } else {
      return 0;
    }

    if (record.level === deepest) {
      score += 10;
    }
  } else if (input.postalCode && record.postalCodes.length > 0) {
    score += 10;
  }

  return score;
}

function indexRecordsByProviderId(
  records: ProviderLocationRecord[],
): Map<string, ProviderLocationRecord> {
  return new Map(records.map((record) => [record.providerId, record]));
}

export function scoreLocationCandidates(
  input: LocationMethodInput,
  records: ProviderLocationRecord[],
): ScoredLocationRecord[] {
  const recordsByProviderId = indexRecordsByProviderId(records);
  return records
    .map((record) => ({
      record,
      score: scoreLocationRecord(input, record, recordsByProviderId),
    }))
    .filter((candidate) => candidate.score >= MIN_RESOLUTION_SCORE)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.record.providerId.localeCompare(right.record.providerId);
    });
}

export function pickBestScoredCandidates(
  scored: ScoredLocationRecord[],
): ScoredLocationRecord[] {
  if (scored.length === 0) {
    return [];
  }
  const topScore = scored[0]!.score;
  return scored.filter((candidate) => candidate.score === topScore);
}
