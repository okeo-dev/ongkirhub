export interface WidgetConfig {
  apiUrl: string;
  container: string | HTMLElement;
  /** Default origin postal code. Country is hardcoded to ID in v0.1. */
  defaultOriginPostalCode?: string;
  /** Default destination postal code. Country is hardcoded to ID in v0.1. */
  defaultDestinationPostalCode?: string;
  labels?: Partial<WidgetLabels>;
  themePrefix?: string;
}

export interface WidgetLabels {
  originPostalCode: string;
  destinationPostalCode: string;
  weight: string;
  submit: string;
  loading: string;
  noResults: string;
  errorPrefix: string;
}

export const DEFAULT_LABELS: WidgetLabels = {
  originPostalCode: "Origin Postal Code",
  destinationPostalCode: "Destination Postal Code",
  weight: "Weight (grams)",
  submit: "Get Quotes",
  loading: "Loading...",
  noResults: "No shipping options found.",
  errorPrefix: "Error:",
};
