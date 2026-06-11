import {
  ProviderError,
  type ProviderCapabilities,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "@ongkirhub/core";
import { ShippoClient } from "./client.js";
import {
  type ShippoProviderConfig,
  validateShippoProviderConfig,
} from "./config.js";
import { SHIPPO_PROVIDER_KEY, mapShippoRatesToQuotes } from "./quotes.js";

export interface ShippoProvider extends ShippingProvider {
  getDebugInfo?(): object;
}

export interface ShippoRequestMetadata {
  originLine1?: string;
  destinationLine1?: string;
  originPhone?: string;
  destinationPhone?: string;
  certify?: boolean;
  certifySigner?: string;
  contentsType?: string;
  contentsExplanation?: string;
  eelPfc?: string;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function readShippoMetadata(
  request: QuoteRequest,
): ShippoRequestMetadata | undefined {
  const raw = request.metadata?.shippo;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const metadata: ShippoRequestMetadata = {};

  if (hasNonEmptyString(input.originLine1)) {
    metadata.originLine1 = input.originLine1.trim();
  }
  if (hasNonEmptyString(input.destinationLine1)) {
    metadata.destinationLine1 = input.destinationLine1.trim();
  }
  if (hasNonEmptyString(input.originPhone)) {
    metadata.originPhone = input.originPhone.trim();
  }
  if (hasNonEmptyString(input.destinationPhone)) {
    metadata.destinationPhone = input.destinationPhone.trim();
  }
  if (typeof input.certify === "boolean") {
    metadata.certify = input.certify;
  }
  if (hasNonEmptyString(input.certifySigner)) {
    metadata.certifySigner = input.certifySigner.trim();
  }
  if (hasNonEmptyString(input.contentsType)) {
    metadata.contentsType = input.contentsType.trim();
  }
  if (hasNonEmptyString(input.contentsExplanation)) {
    metadata.contentsExplanation = input.contentsExplanation.trim();
  }
  if (hasNonEmptyString(input.eelPfc)) {
    metadata.eelPfc = input.eelPfc.trim();
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function toShippoAddress(
  location: QuoteRequest["origin"],
  line1?: string,
  phone?: string,
) {
  return {
    country: location.countryCode,
    zip: location.postalCode,
    state: location.level1,
    city: location.level2,
    ...(line1 ? { street1: line1 } : {}),
    ...(phone ? { phone } : {}),
  };
}

function buildShippoCustomsDeclaration(
  request: QuoteRequest,
  metadata: ShippoRequestMetadata | undefined,
): import("./client.js").ShippoCustomsDeclaration {
  const items = request.items!;
  const certify = metadata?.certify ?? true;
  const certifySigner = metadata?.certifySigner ?? "-";
  const contentsType = metadata?.contentsType ?? "MERCHANDISE";

  return {
    certify,
    certify_signer: certifySigner,
    contents_type: contentsType,
    ...(metadata?.contentsExplanation
      ? { contents_explanation: metadata.contentsExplanation }
      : {}),
    ...(metadata?.eelPfc ? { eel_pfc: metadata.eelPfc } : {}),
    items: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      net_weight: String(item.weightGrams),
      mass_unit: "g",
      value_amount: String(item.declaredValue?.amount ?? 0),
      value_currency: item.declaredValue?.currency ?? "USD",
      origin_country: item.originCountryCode ?? request.origin.countryCode,
      ...(item.hsCode ? { hs_code: item.hsCode } : {}),
    })),
  };
}

export function createShippoProvider(
  config: ShippoProviderConfig,
): ShippoProvider {
  const validated = validateShippoProviderConfig(config);
  const client = new ShippoClient({
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

  const provider: ShippoProvider = {
    key: SHIPPO_PROVIDER_KEY,
    name: "Shippo",
    capabilities,
    async getQuotes(request: QuoteRequest): Promise<Quote[]> {
      const isInternational =
        request.origin.countryCode !== request.destination.countryCode;

      const originPostalCode = request.origin.postalCode?.trim();
      const destinationPostalCode = request.destination.postalCode?.trim();

      if (!originPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Shippo requires origin postal code",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      if (!destinationPostalCode) {
        throw new ProviderError(
          "LOCATION_NOT_FOUND",
          "Shippo requires destination postal code",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      const dimensions = request.parcels[0]?.dimensions;
      if (!dimensions) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Shippo requires parcel dimensions (lengthCm, widthCm, heightCm)",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      const shippoMetadata = readShippoMetadata(request);

      if (isInternational && !request.items?.length) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Shippo international quotes require request.items with description, quantity, weightGrams, and declaredValue",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      if (isInternational && !shippoMetadata?.originPhone) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Shippo international quotes require metadata.shippo.originPhone",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      if (isInternational && !shippoMetadata?.destinationPhone) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Shippo international quotes require metadata.shippo.destinationPhone",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      if (isInternational && !shippoMetadata?.originLine1) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Shippo international quotes require metadata.shippo.originLine1",
          { providerKey: SHIPPO_PROVIDER_KEY },
        );
      }

      if (isInternational && !shippoMetadata?.destinationLine1) {
        throw new ProviderError(
          "INVALID_REQUEST",
          "Shippo international quotes require metadata.shippo.destinationLine1",
          { providerKey: SHIPPO_PROVIDER_KEY },
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
            `Shippo international quotes require items[${missingDeclaredValueIndex}].declaredValue`,
            { providerKey: SHIPPO_PROVIDER_KEY },
          );
        }
      }

      const parcel = {
        weight: request.totalWeightGrams,
        mass_unit: "g" as const,
        length: dimensions.lengthCm,
        width: dimensions.widthCm,
        height: dimensions.heightCm,
        distance_unit: "cm" as const,
      };

      const fromAddress = toShippoAddress(
        request.origin,
        shippoMetadata?.originLine1,
        shippoMetadata?.originPhone,
      );
      const toAddress = toShippoAddress(
        request.destination,
        shippoMetadata?.destinationLine1,
        shippoMetadata?.destinationPhone,
      );

      const shipmentParams: import("./client.js").CreateShipmentParams = {
        fromAddress,
        toAddress,
        parcel,
      };

      if (isInternational) {
        shipmentParams.customsDeclaration = buildShippoCustomsDeclaration(
          request,
          shippoMetadata,
        );
      }

      if (validated.debug) {
        lastDebugInfo = {
          originPostalCode,
          destinationPostalCode,
          fromAddress,
          toAddress,
          weightGrams: parcel.weight,
          carriers: validated.carriers,
          customsDeclaration: shipmentParams.customsDeclaration,
        };
      }

      const shipment = await client.createShipment(shipmentParams);

      const quotes = mapShippoRatesToQuotes(shipment.rates, {
        carrierFilter: validated.carriers.length > 0 ? validated.carriers : undefined,
      });

      if (
        validated.carriers.length > 0 &&
        quotes.length === 0 &&
        shipment.rates.length > 0
      ) {
        // Rates were returned, but none matched the requested carriers.
        // This usually means the requested carrier names do not match accounts
        // configured in Shippo, or the filter is misconfigured.
        throw new ProviderError(
          "UNKNOWN_PROVIDER_FAILURE",
          `Shippo returned no rates for requested carriers: ${validated.carriers.join(", ")}. Check carrier account configuration.`,
          { providerKey: SHIPPO_PROVIDER_KEY },
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
