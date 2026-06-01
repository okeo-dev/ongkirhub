export type CoverageScope = "domestic" | "international";

export interface ProviderCapabilities {
  coverage: CoverageScope[];
  dimensionsRequired: boolean;
  codSupported: boolean;
  serviceFilteringSupported: boolean;
}
