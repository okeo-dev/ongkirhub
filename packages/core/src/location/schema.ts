export interface ProviderLocationMappingNode {
  providerId: string;
  name: string;
  aliases?: string[];
  postalCodes?: string[];
  children?: ProviderLocationMappingNode[];
}

export interface ProviderLocationMappingCountry {
  countryCode: string;
  nodes: ProviderLocationMappingNode[];
}

export interface ProviderLocationMappingDocument {
  provider: string;
  version: string;
  countries: ProviderLocationMappingCountry[];
}
