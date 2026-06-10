import {
  ProviderError,
  type ProviderCapabilities,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";
import { EasyshipClient } from "./client.js";
import {
  type EasyshipProviderConfig,
  validateEasyshipProviderConfig,
} from "./config.js";
import { EASYSHIP_PROVIDER_KEY, mapEasyshipRatesToQuotes } from "./quotes.js";

export interface EasyshipProvider extends ShippingProvider {
  getDebugInfo?(): object;
}

export interface EasyshipRequestMetadata {
  originLine1?: string;
  destinationLine1?: string;
  hsCode?: string;
  category?: string;
  setAsResidential?: boolean;
  calculateTaxAndDuties?: boolean;
  incoterms?: "DDU" | "DDP" | null;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function readEasyshipMetadata(
  request: QuoteRequest,
): EasyshipRequestMetadata | undefined {
  const raw = request.metadata?.easyship;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const metadata: EasyshipRequestMetadata = {};

  if (hasNonEmptyString(input.originLine1)) {
    metadata.originLine1 = input.originLine1.trim();
  }
  if (hasNonEmptyString(input.destinationLine1)) {
    metadata.destinationLine1 = input.destinationLine1.trim();
  }
  if (hasNonEmptyString(input.hsCode)) {
    metadata.hsCode = input.hsCode.trim();
  }
  if (hasNonEmptyString(input.category)) {
    metadata.category = input.category.trim();
  }
  if (typeof input.setAsResidential === "boolean") {
    metadata.setAsResidential = input.setAsResidential;
  }
  if (typeof input.calculateTaxAndDuties === "boolean") {
    metadata.calculateTaxAndDuties = input.calculateTaxAndDuties;
  }
  if (
    input.incoterms === "DDU" ||
    input.incoterms === "DDP" ||
    input.incoterms === null
  ) {
    metadata.incoterms = input.incoterms;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function toEasyshipAddress(
  location: QuoteRequest["origin"],
  line1?: string,
) {
  return {
    country_alpha2: location.countryCode,
    postal_code: location.postalCode,
    state: location.level1,
    city: location.level2,
    ...(line1 ? { line_1: line1 } : {}),
  };
}

function buildEasyshipParcel(
  request: QuoteRequest,
  dimensions: import("@ongkirhub/core").Dimensions,
  metadata: EasyshipRequestMetadata | undefined,
): { items: import("./client.js").EasyshipItem[] } {
  if (request.items && request.items.length > 0) {
    return {
      items: request.items.map((item) => ({
        description: item.description,
        category: metadata?.category ?? "others",
        quantity: item.quantity,
        actual_weight: item.weightGrams / 1000,
        declared_currency: item.declaredValue!.currency,
        declared_customs_value: item.declaredValue!.amount,
        hs_code: item.hsCode,
        ...(item.originCountryCode
          ? { origin_country_alpha2: item.originCountryCode }
          : {}),
        dimensions: {
          length: dimensions.lengthCm,
          width: dimensions.widthCm,
          height: dimensions.heightCm,
        },
      })),
    };
  }

  // Domestic fallback: synthesize a single placeholder item.
  return {
    items: [
      {
        description: "Documents",
        category: "documents",
        quantity: 1,
        actual_weight: request.totalWeightGrams / 1000,
        declared_currency: "USD",
        declared_customs_value: 0,
        hs_code: metadata?.hsCode ?? "49011000",
        dimensions: {
          length: dimensions.lengthCm,
          width: dimensions.widthCm,
          height: dimensions.heightCm,
        },
      },
    ],
  };
}

export function createEasyshipProvider(
  config: EasyshipProviderConfig,
): EasyshipProvider {
  const validated = validateEasyshipProviderConfig(config);
  const client = new EasyshipClient({
    apiKey: validated.apiKey,
    baseUrl: validated.baseUrl,
    debug: validated.debug,
  });

  const capabilities: ProviderCapabilities = {
    coverage: ["domestic", "international"],
    dimensionsRequired: true,
    codSupported: false,
    serviceFilteringSupported: true,
  };

  let lastDebugInfo: object | undefined;

  const provider: EasyshipProvider = {
    key: EASYSHIP_PROVIDER_KEY,
    name: "Easyship",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      const isInternational =
        request.origin.countryCode !== request.destination.countryCode;

      const originPostalCode = request.origin.postalCode?.trim();
      const destinationPostalCode = request.destination.postalCode?.trim();

      if (!originPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Easyship requires origin postal code",
          { providerKey: EASYSHIP_PROVIDER_KEY },
        );
      }

      if (!destinationPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Easyship requires destination postal code",
          { providerKey: EASYSHIP_PROVIDER_KEY },
        );
      }

      const dimensions = request.parcels[0]?.dimensions;
      if (!dimensions) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Easyship requires parcel dimensions (lengthCm, widthCm, heightCm)",
          { providerKey: EASYSHIP_PROVIDER_KEY },
        );
      }

      const easyshipMetadata = readEasyshipMetadata(request);

      if (isInternational && !request.items?.length) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Easyship international quotes require request.items with description, quantity, weightGrams, and declaredValue",
          { providerKey: EASYSHIP_PROVIDER_KEY },
        );
      }

      if (isInternational) {
        const missingDeclaredValueIndex = request.items?.findIndex(
          (item) => item.declaredValue === undefined,
        );
        if (
          missingDeclaredValueIndex !== undefined &&
          missingDeclaredValueIndex >= 0
        ) {
          throw new ProviderError(
            "INVALID_REQUEST",
            `Easyship international quotes require items[${missingDeclaredValueIndex}].declaredValue`,
            { providerKey: EASYSHIP_PROVIDER_KEY },
          );
        }
      }

      const parcel = buildEasyshipParcel(request, dimensions, easyshipMetadata);

      const originAddress = toEasyshipAddress(
        request.origin,
        easyshipMetadata?.originLine1,
      );
      const destinationAddress = toEasyshipAddress(
        request.destination,
        easyshipMetadata?.destinationLine1,
      );

      if (validated.debug) {
        lastDebugInfo = {
          originPostalCode,
          destinationPostalCode,
          originAddress,
          destinationAddress,
          weightKg: request.totalWeightGrams / 1000,
          items: parcel.items,
          carriers: validated.carriers,
          easyshipMetadata,
        };
      }

      const response = await client.requestRates({
        originAddress,
        destinationAddress,
        parcel,
        setAsResidential: easyshipMetadata?.setAsResidential,
        incoterms: easyshipMetadata?.incoterms,
        calculateTaxAndDuties: easyshipMetadata?.calculateTaxAndDuties,
      });

      const quotes = mapEasyshipRatesToQuotes(response.rates, {
        carrierFilter: validated.carriers.length > 0 ? validated.carriers : undefined,
      });

      if (
        validated.carriers.length > 0 &&
        quotes.length === 0 &&
        response.rates.length > 0
      ) {
        // Rates were returned, but none matched the requested carriers.
        // This usually means the requested carrier names do not match accounts
        // configured in Easyship, or the filter is misconfigured.
        throw new ProviderError(
          "UNKNOWN_PROVIDER_FAILURE",
          `Easyship returned no rates for requested carriers: ${validated.carriers.join(", ")}. Check carrier account configuration.`,
          { providerKey: EASYSHIP_PROVIDER_KEY },
        );
      }

      return quotes;
    },
  };

  if (validated.debug) {
    provider.getDebugInfo = () => lastDebugInfo ?? {};
  }

  return provider;
}
