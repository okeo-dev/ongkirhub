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

interface EasyshipRequestMetadata {
  originLine1?: string;
  destinationLine1?: string;
  hsCode?: string;
  setAsResidential?: boolean;
  calculateTaxAndDuties?: boolean;
  incoterms?: "DDU" | "DDP" | null;
}

function readEasyshipMetadata(
  request: QuoteRequest,
): EasyshipRequestMetadata | undefined {
  const raw = request.metadata?.easyship;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  return raw as EasyshipRequestMetadata;
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
    coverage: ["domestic"],
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
      if (request.origin.countryCode !== request.destination.countryCode) {
        throw new ProviderError(
          "UNSUPPORTED_ROUTE",
          "Easyship alpha only supports domestic (same-country) shipments",
          { providerKey: EASYSHIP_PROVIDER_KEY },
        );
      }

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
          "Easyship alpha requires parcel dimensions (lengthCm, widthCm, heightCm)",
          { providerKey: EASYSHIP_PROVIDER_KEY },
        );
      }

      const easyshipMetadata = readEasyshipMetadata(request);
      const parcel = {
        // Easyship rates require at least one parcel item even for domestic quotes.
        // Keep this synthetic item provider-local; do not promote it into the public contract.
        items: [
          {
            description: "Documents",
            category: "documents",
            quantity: 1,
            actual_weight: request.totalWeightGrams / 1000,
            declared_currency: "USD",
            declared_customs_value: 0,
            hs_code: easyshipMetadata?.hsCode ?? "49011000",
            dimensions: {
              length: dimensions.lengthCm,
              width: dimensions.widthCm,
              height: dimensions.heightCm,
            },
          },
        ],
      };

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
