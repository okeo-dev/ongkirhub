import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  assertProviderConformance,
} from "@ongkirhub/core";
import { createEasyPostProvider } from "../src/provider.js";
import {
  loadEasyPostConfigFromEnv,
  requireEasyPostConfigFromEnv,
  validateEasyPostProviderConfig,
} from "../src/config.js";
import { mapEasyPostRatesToQuotes, parseEstimatedDuration } from "../src/quotes.js";

const baseConfig = {
  apiKey: "test-api-key",
  carriers: [],
};

const usOrigin = {
  method: "location" as const,
  countryCode: "US",
  postalCode: "90210",
  level1: "CA",
  level2: "Beverly Hills",
};

const usDestination = {
  method: "location" as const,
  countryCode: "US",
  postalCode: "10001",
  level1: "NY",
  level2: "New York",
};

function makeEasyPostShipmentResponse(rates: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: "shp_test",
      rates,
    }),
  };
}

describe("validateEasyPostProviderConfig", () => {
  it("requires apiKey", () => {
    expect(() =>
      validateEasyPostProviderConfig({
        apiKey: "",
        carriers: [],
      }),
    ).toThrow(ProviderError);

    expect(() =>
      validateEasyPostProviderConfig({
        apiKey: "",
        carriers: [],
      }),
    ).toThrow(/requires apiKey/);
  });

  it("applies default base URL", () => {
    const config = validateEasyPostProviderConfig({
      apiKey: "key",
      carriers: [],
    });
    expect(config.baseUrl).toBe("https://api.easypost.com/v2");
  });
});

describe("loadEasyPostConfigFromEnv", () => {
  it("returns undefined when no EasyPost env vars are present", () => {
    expect(loadEasyPostConfigFromEnv({})).toBeUndefined();
  });

  it("parses all env vars correctly", () => {
    const config = loadEasyPostConfigFromEnv({
      EASYPOST_API_KEY: "test-key",
      EASYPOST_CARRIERS: "USPS, UPS",
      EASYPOST_BASE_URL: "https://example.com",
      EASYPOST_DEBUG: "true",
    });
    expect(config).toEqual({
      apiKey: "test-key",
      carriers: ["USPS", "UPS"],
      baseUrl: "https://example.com",
      debug: true,
    });
  });
});

describe("requireEasyPostConfigFromEnv", () => {
  it("throws when EASYPOST_API_KEY is missing", () => {
    expect(() =>
      requireEasyPostConfigFromEnv({}),
    ).toThrow(/EASYPOST_API_KEY is required/);
  });

  it("returns config when required fields are present", () => {
    const config = requireEasyPostConfigFromEnv({
      EASYPOST_API_KEY: "test-key",
      EASYPOST_CARRIERS: "USPS,UPS",
    });
    expect(config).toEqual({
      apiKey: "test-key",
      carriers: ["USPS", "UPS"],
      debug: false,
    });
  });
});

describe("parseEstimatedDuration", () => {
  it("uses delivery_days when present", () => {
    expect(parseEstimatedDuration(2)).toEqual({ value: 2, unit: "days" });
  });

  it("falls back to 3 days when absent", () => {
    expect(parseEstimatedDuration(undefined)).toEqual({ value: 3, unit: "days" });
  });
});

describe("mapEasyPostRatesToQuotes", () => {
  it("maps EasyPost rates into normalized quotes", () => {
    const quotes = mapEasyPostRatesToQuotes([
      {
        id: "rate_1",
        carrier: "USPS",
        service: "Priority",
        rate: "11.01",
        currency: "USD",
        delivery_days: 2,
        carrier_account_id: "ca_1",
        shipment_id: "shp_1",
      },
    ] as import("../src/client.js").EasyPostRate[]);

    expect(quotes[0]).toMatchObject({
      providerKey: "easypost",
      serviceCode: "USPS-PRIORITY",
      serviceName: "USPS Priority",
      price: { amount: 11.01, currency: "USD" },
      estimatedDuration: { value: 2, unit: "days" },
    });
  });

  it("filters rates by carrier when carrierFilter is provided", () => {
    const quotes = mapEasyPostRatesToQuotes(
      [
        { id: "rate_1", carrier: "USPS", service: "Priority", rate: "11.01", currency: "USD", carrier_account_id: "ca_1", shipment_id: "shp_1" },
        { id: "rate_2", carrier: "UPS", service: "Ground", rate: "12.50", currency: "USD", carrier_account_id: "ca_2", shipment_id: "shp_1" },
      ] as import("../src/client.js").EasyPostRate[],
      { carrierFilter: ["USPS"] },
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.serviceCode).toBe("USPS-PRIORITY");
  });
});

describe("createEasyPostProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls EasyPost shipment endpoint with converted units", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeEasyPostShipmentResponse([
        {
          id: "rate_1",
          carrier: "USPS",
          service: "Priority",
          rate: "11.01",
          currency: "USD",
          delivery_days: 2,
          carrier_account_id: "ca_1",
          shipment_id: "shp_1",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createEasyPostProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [{ weightGrams: 28349.5, dimensions: { lengthCm: 25.4, widthCm: 20.32, heightCm: 15.24 } }],
      totalWeightGrams: 28349.5,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(11.01);

    const [url, requestInit] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.easypost.com/v2/shipments");
    expect(requestInit?.method).toBe("POST");
    const body = JSON.parse(requestInit?.body as string);
    expect(body.shipment.from_address).toMatchObject({
      country: "US",
      zip: "90210",
      state: "CA",
      city: "Beverly Hills",
    });
    expect(body.shipment.to_address).toMatchObject({
      country: "US",
      zip: "10001",
      state: "NY",
      city: "New York",
    });
    expect(body.shipment.parcel.weight).toBeCloseTo(1000, 1);
    expect(body.shipment.parcel.length).toBeCloseTo(10, 1);
    expect(body.shipment.parcel.width).toBeCloseTo(8, 1);
    expect(body.shipment.parcel.height).toBeCloseTo(6, 1);

    const authHeader = (requestInit?.headers as Record<string, string>).authorization;
    expect(authHeader).toMatch(/^Basic /);
  });

  it("throws when origin postal code is missing", async () => {
    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: { ...usOrigin, postalCode: undefined },
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws when destination postal code is missing", async () => {
    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: { ...usDestination, postalCode: undefined },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws for cross-country routes", async () => {
    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: { ...usDestination, countryCode: "CA" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_ROUTE" });
  });

  it("maps upstream auth failures to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Invalid API key" } }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_AUTH_FAILURE" });
  });

  it("maps upstream rate limit to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Rate limit exceeded" } }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMIT" });
  });

  it("maps upstream 5xx to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: "Service unavailable" } }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("maps address verification failures to LOCATION_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            code: "ADDRESS.VERIFY.FAILURE",
            message: "Unable to verify address.",
          },
        }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("maps invalid country to UNSUPPORTED_ROUTE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            code: "ADDRESS.COUNTRY.INVALID",
            message: "Invalid country code",
          },
        }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_ROUTE" });
  });

  it("maps missing parameter failures to INVALID_REQUEST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: "PARAMETER.REQUIRED",
            message: "Missing required parameter.",
            errors: [{ field: "parcel", message: "Parcel is required" }],
          },
        }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("maps address field errors to LOCATION_NOT_FOUND when code is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Address problem",
            errors: [{ field: "to_address", message: "Invalid destination" }],
          },
        }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("maps SHIPMENT.RATES.UNAVAILABLE to UNKNOWN_PROVIDER_FAILURE, not INVALID_REQUEST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            code: "SHIPMENT.RATES.UNAVAILABLE",
            message: "No rates found for this shipment",
          },
        }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_PROVIDER_FAILURE" });
  });

  it("falls back to UNKNOWN_PROVIDER_FAILURE for unclassified 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 418,
        json: async () => ({ error: { message: "I'm a teapot" } }),
      }),
    );

    const provider = createEasyPostProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_PROVIDER_FAILURE" });
  });

  it("surfaces provider misconfiguration when requested carriers are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeEasyPostShipmentResponse([
          {
            id: "rate_1",
            carrier: "USPS",
            service: "Priority",
            rate: "11.01",
            currency: "USD",
            carrier_account_id: "ca_1",
            shipment_id: "shp_1",
          },
        ]),
      ),
    );

    const provider = createEasyPostProvider({
      apiKey: "test-key",
      carriers: ["UPS"], // Requested UPS, but only USPS returned
    });

    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({
      code: "UNKNOWN_PROVIDER_FAILURE",
      message: /UPS/,
    });
  });

  it("passes provider conformance with mocked upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeEasyPostShipmentResponse([
          {
            id: "rate_1",
            carrier: "USPS",
            service: "Priority",
            rate: "11.01",
            currency: "USD",
            delivery_days: 2,
            carrier_account_id: "ca_1",
            shipment_id: "shp_1",
          },
        ]),
      ),
    );

    const provider = createEasyPostProvider(baseConfig);
    await assertProviderConformance(provider, {
      sampleRequest: {
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      },
    });
  });

  it("does not expose getDebugInfo when debug is disabled", () => {
    const provider = createEasyPostProvider(baseConfig);
    expect((provider as Record<string, unknown>).getDebugInfo).toBeUndefined();
  });

  it("exposes request info via getDebugInfo when debug is enabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeEasyPostShipmentResponse([])));

    const provider = createEasyPostProvider({ ...baseConfig, debug: true });
    await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    const debugInfo = (provider as Record<string, () => object>).getDebugInfo!();
    expect(debugInfo).toMatchObject({
      originPostalCode: "90210",
      destinationPostalCode: "10001",
      carriers: [],
    });
  });
});
