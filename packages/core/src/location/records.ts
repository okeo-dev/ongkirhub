import { normalizeLocationToken, normalizePostalCode } from "./normalize.js";
import type {
  ProviderLocationMappingCountry,
  ProviderLocationMappingDocument,
  ProviderLocationMappingNode,
} from "./schema.js";

export interface LocationPathSnapshot {
  level1?: string;
  level2?: string;
  level3?: string;
  level4?: string;
}

export type ProviderLocationLevel = 1 | 2 | 3 | 4;

export interface ProviderLocationRecord {
  provider: string;
  providerId: string;
  countryCode: string;
  level: ProviderLocationLevel;
  name: string;
  normalizedName: string;
  normalizedAliases: string[];
  postalCodes: string[];
  parentProviderId?: string;
  path: LocationPathSnapshot;
}

function normalizeAliasList(aliases: string[] | undefined): string[] {
  if (!aliases?.length) {
    return [];
  }
  return aliases.map((alias) => normalizeLocationToken(alias));
}

function normalizePostalCodes(postalCodes: string[] | undefined): string[] {
  if (!postalCodes?.length) {
    return [];
  }
  return postalCodes.map((code) => normalizePostalCode(code));
}

function walkNodes(
  provider: string,
  countryCode: string,
  nodes: ProviderLocationMappingNode[],
  parentProviderId: string | undefined,
  path: LocationPathSnapshot,
  level: ProviderLocationLevel,
  output: ProviderLocationRecord[],
): void {
  for (const node of nodes) {
    const pathKey = `level${level}` as keyof LocationPathSnapshot;
    const nextPath: LocationPathSnapshot = {
      ...path,
      [pathKey]: node.name,
    };

    output.push({
      provider,
      providerId: node.providerId,
      countryCode,
      level,
      name: node.name,
      normalizedName: normalizeLocationToken(node.name),
      normalizedAliases: normalizeAliasList(node.aliases),
      postalCodes: normalizePostalCodes(node.postalCodes),
      parentProviderId,
      path: nextPath,
    });

    if (node.children?.length && level < 4) {
      walkNodes(
        provider,
        countryCode,
        node.children,
        node.providerId,
        nextPath,
        (level + 1) as ProviderLocationLevel,
        output,
      );
    }
  }
}

export function compileMappingDocumentToRecords(
  document: ProviderLocationMappingDocument,
): ProviderLocationRecord[] {
  const records: ProviderLocationRecord[] = [];

  for (const country of document.countries) {
    appendCountryRecords(document.provider, country, records);
  }

  return records;
}

function appendCountryRecords(
  provider: string,
  country: ProviderLocationMappingCountry,
  output: ProviderLocationRecord[],
): void {
  const countryCode = country.countryCode.trim().toUpperCase();
  walkNodes(provider, countryCode, country.nodes, undefined, {}, 1, output);
}
