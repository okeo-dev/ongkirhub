import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  assertProviderConformance,
} from "@ongkirhub/core";
import { createEasyshipProvider } from "../src/provider.js";
import {
  loadEasyshipConfigFromEnv,
  requireEasyshipConfigFromEnv,
  validateEasyshipProviderConfig,
} from "../src/config.js";
import { mapEasyshipRatesToQuotes, parseEstimatedDuration } from "../src/quotes.js";

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

const defaultParcel = {
  weightGrams: 1500,
  dimensions: { lengthCm: 25, widthCm: 20, heightCm: 15 },
};

function makeEasyshipRatesResponse(rates: unknown[]) {
  const body = JSON.stringify({ rates });
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => ({ rates }),
  };
}

function makeEasyshipRate(overrides: Partial<import("../src/client.js").EasyshipRate> = {}) {
  return {
    courier_id: "usps",
    courier_name: "USPS",
    service_level_name: "Priority Mail",
    total_charge: 11.01,
    currency: "USD",
    delivery_days: 2,
    ...overrides,
  };
}

describe("validateEasyshipProviderConfig", () => {
  it("requires apiKey", () => {
    expect(() =>
      validateEasyshipProviderConfig({ apiKey: "", carriers: [] }),
    ).toThrow(ProviderError);

    expect(() =>
      validateEasyshipProviderConfig({ apiKey: "", carriers: [] }),
    ).toThrow(/requires apiKey/);
  });

  it("applies default base URL", () => {
    const config = validateEasyshipProviderConfig({
      apiKey: "key",
      carriers: [],
    });
    expect(config.baseUrl).toBe("https://public-api.easyship.com");
  });
});

describe("loadEasyshipConfigFromEnv", () => {
  it("returns undefined when no Easyship env vars are present", () => {
    expect(loadEasyshipConfigFromEnv({})).toBeUndefined();
  });

  it("parses all env vars correctly", () => {
    const config = loadEasyshipConfigFromEnv({
      EASYSHIP_API_KEY: "test-key",
      EASYSHIP_CARRIERS: "USPS, UPS",
      EASYSHIP_BASE_URL: "https://example.com",
      EASYSHIP_DEBUG: "true",
    });
    expect(config).toEqual({
      apiKey: "test-key",
      carriers: ["USPS", "UPS"],
      baseUrl: "https://example.com",
      debug: true,
    });
  });
});

describe("requireEasyshipConfigFromEnv", () => {
  it("throws when EASYSHIP_API_KEY is missing", () => {
    expect(() => requireEasyshipConfigFromEnv({})).toThrow(
      /EASYSHIP_API_KEY is required/,
    );
  });

  it("returns config when required fields are present", () => {
    const config = requireEasyshipConfigFromEnv({
      EASYSHIP_API_KEY: "test-key",
      EASYSHIP_CARRIERS: "USPS,UPS",
    });
    expect(config).toEqual({
      apiKey: "test-key",
      carriers: ["USPS", "UPS"],
      debug: false,
    });
  });
});

describe("parseEstimatedDuration", () => {
  it("uses days when present", () => {
    expect(parseEstimatedDuration(2)).toEqual({ value: 2, unit: "days" });
  });

  it("falls back to 3 days when absent", () => {
    expect(parseEstimatedDuration(undefined)).toEqual({ value: 3, unit: "days" });
  });
});

describe("mapEasyshipRatesToQuotes", () => {
  it("maps Easyship rates into normalized quotes", () => {
    const quotes = mapEasyshipRatesToQuotes([
      makeEasyshipRate({
        courier_id: "usps",
        courier_name: "USPS",
        service_level_name: "Priority Mail",
        total_charge: 11.01,
        currency: "USD",
        delivery_days: 2,
      }),
    ] as import("../src/client.js").EasyshipRate[]);

    expect(quotes[0]).toMatchObject({
      providerKey: "easyship",
      serviceCode: "USPS-PRIORITY_MAIL",
      serviceName: "USPS Priority Mail",
      price: { amount: 11.01, currency: "USD" },
      estimatedDuration: { value: 2, unit: "days" },
    });
  });

  it("filters rates by carrier when carrierFilter is provided", () => {
    const quotes = mapEasyshipRatesToQuotes(
      [
        makeEasyshipRate({ courier_id: "usps", courier_name: "USPS", service_level_name: "Priority" }),
        makeEasyshipRate({ courier_id: "ups", courier_name: "UPS", service_level_name: "Ground", total_charge: 12.5 }),
      ] as import("../src/client.js").EasyshipRate[],
      { carrierFilter: ["USPS"] },
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.serviceCode).toBe("USPS-PRIORITY");
  });
});

describe("createEasyshipProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls Easyship rates endpoint with correct domestic request shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeEasyshipRatesResponse([
        makeEasyshipRate({
          courier_id: "usps",
          courier_name: "USPS",
          service_level_name: "Priority Mail",
          total_charge: 11.01,
          currency: "USD",
          delivery_days: 2,
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createEasyshipProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [defaultParcel],
      totalWeightGrams: 1500,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(11.01);

    const [url, requestInit] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://public-api.easyship.com/2024-09/rates");
    expect(requestInit?.method).toBe("POST");
    const body = JSON.parse(requestInit?.body as string);
    expect(body.origin_address).toMatchObject({
      country_alpha2: "US",
      postal_code: "90210",
      state: "CA",
      city: "Beverly Hills",
    });
    expect(body.destination_address).toMatchObject({
      country_alpha2: "US",
      postal_code: "10001",
      state: "NY",
      city: "New York",
    });
    expect(body.parcels[0]).toMatchObject({
      items: [
        {
          description: "Documents",
          category: "documents",
          quantity: 1,
          actual_weight: 1.5,
          declared_currency: "USD",
          declared_customs_value: 0,
          hs_code: "49011000",
          dimensions: { length: 25, width: 20, height: 15 },
        },
      ],
    });
    expect(body.insurance).toEqual({ is_insured: false });
    expect(body.courier_settings).toEqual({
      show_courier_logo_url: false,
      apply_shipping_rules: true,
    });
    expect(body.shipping_settings).toEqual({
      units: { weight: "kg", dimensions: "cm" },
    });
    expect(body.incoterms).toBe("DDU");
    expect(body.calculate_tax_and_duties).toBe(true);

    const authHeader = (requestInit?.headers as Record<string, string>).authorization;
    expect(authHeader).toMatch(/^Bearer /);
  });

  it("throws when parcel dimensions are missing", async () => {
    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1500 }],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("throws when origin postal code is missing", async () => {
    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: { ...usOrigin, postalCode: undefined },
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws when destination postal code is missing", async () => {
    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: { ...usDestination, postalCode: undefined },
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws INVALID_REQUEST for cross-country routes without items", async () => {
    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: { ...usDestination, countryCode: "CA" },
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("accepts cross-country routes when request.items is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeEasyshipRatesResponse([
        makeEasyshipRate({
          courier_id: "usps",
          courier_name: "USPS",
          service_level_name: "Priority Mail International",
          total_charge: 45.0,
          currency: "USD",
          delivery_days: 5,
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createEasyshipProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: usOrigin,
      destination: { ...usDestination, countryCode: "CA", postalCode: "M5V 3A8", level1: "ON", level2: "Toronto" },
      parcels: [defaultParcel],
      totalWeightGrams: 1500,
      items: [
        {
          description: "Handmade ceramic mug",
          quantity: 2,
          weightGrams: 500,
          declaredValue: { amount: 25.0, currency: "USD" },
          hsCode: "691200",
          originCountryCode: "US",
        },
      ],
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(45.0);

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(requestInit?.body as string);
    expect(body.parcels[0].items[0]).toMatchObject({
      description: "Handmade ceramic mug",
      category: "others",
      quantity: 2,
      actual_weight: 0.5,
      declared_currency: "USD",
      declared_customs_value: 25.0,
      hs_code: "691200",
      origin_country_alpha2: "US",
    });
  });

  it("throws INVALID_REQUEST when international items omit declaredValue", async () => {
    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: {
          ...usDestination,
          countryCode: "CA",
          postalCode: "M5V 3A8",
          level1: "ON",
          level2: "Toronto",
        },
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
        items: [
          {
            description: "Handmade ceramic mug",
            quantity: 2,
            weightGrams: 500,
            hsCode: "691200",
            originCountryCode: "US",
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      message: /items\[0\]\.declaredValue/,
    });
  });

  it("maps upstream auth failures to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: "Unauthorized" }),
        json: async () => ({ message: "Unauthorized" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_AUTH_FAILURE" });
  });

  it("maps upstream rate limit to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ message: "Rate limit exceeded" }),
        json: async () => ({ message: "Rate limit exceeded" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_RATE_LIMIT" });
  });

  it("maps upstream 5xx to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ message: "Service unavailable" }),
        json: async () => ({ message: "Service unavailable" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("maps unsupported country to UNSUPPORTED_ROUTE, not LOCATION_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: "Country not supported" }),
        json: async () => ({ message: "Country not supported" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_ROUTE" });
  });

  it("maps route-not-found responses to UNSUPPORTED_ROUTE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: "Route not found" }),
        json: async () => ({ error: "Route not found" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_ROUTE" });
  });

  it("maps address failures to LOCATION_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: "Invalid address: postal_code not found" }),
        json: async () => ({ message: "Invalid address: postal_code not found" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("maps missing parameter failures to INVALID_REQUEST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: "Parcel weight is required" }),
        json: async () => ({ message: "Parcel weight is required" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("maps nested invalid-content payloads to INVALID_REQUEST", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () =>
          JSON.stringify({
            error: {
              code: "invalid_content",
              message: "The request body content is not valid.",
              details: [
                `{"description":"Parcel"} is not any of in #/components/schemas/ParcelRateCreate/properties/items/items`,
              ],
              type: "invalid_request_error",
            },
          }),
        json: async () => ({
          error: {
            code: "invalid_content",
            message: "The request body content is not valid.",
            details: [
              `{"description":"Parcel"} is not any of in #/components/schemas/ParcelRateCreate/properties/items/items`,
            ],
            type: "invalid_request_error",
          },
        }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("passes line_1 and easyship metadata through request metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeEasyshipRatesResponse([]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createEasyshipProvider(baseConfig);
    await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [defaultParcel],
      totalWeightGrams: 1500,
      metadata: {
        easyship: {
          originLine1: "123 Example St",
          destinationLine1: "350 5th Ave",
          hsCode: "49011000",
          setAsResidential: false,
          calculateTaxAndDuties: true,
          incoterms: "DDU",
        },
      },
    });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(requestInit?.body as string);
    expect(body.origin_address.line_1).toBe("123 Example St");
    expect(body.destination_address.line_1).toBe("350 5th Ave");
    expect(body.set_as_residential).toBe(false);
    expect(body.parcels[0].items[0].hs_code).toBe("49011000");
  });

  it("falls back to UNKNOWN_PROVIDER_FAILURE for unclassified 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 418,
        text: async () => JSON.stringify({ message: "I'm a teapot" }),
        json: async () => ({ message: "I'm a teapot" }),
      }),
    );

    const provider = createEasyshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_PROVIDER_FAILURE" });
  });

  it("surfaces provider misconfiguration when requested carriers are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeEasyshipRatesResponse([
          makeEasyshipRate({ courier_id: "usps", courier_name: "USPS", service_level_name: "Priority" }),
        ]),
      ),
    );

    const provider = createEasyshipProvider({
      apiKey: "test-key",
      carriers: ["UPS"],
    });

    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
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
        makeEasyshipRatesResponse([
          makeEasyshipRate({
            courier_id: "usps",
            courier_name: "USPS",
            service_level_name: "Priority Mail",
            total_charge: 11.01,
            currency: "USD",
            delivery_days: 2,
          }),
        ]),
      ),
    );

    const provider = createEasyshipProvider(baseConfig);
    await assertProviderConformance(provider, {
      sampleRequest: {
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1500,
      },
    });
  });

  it("does not expose getDebugInfo when debug is disabled", () => {
    const provider = createEasyshipProvider(baseConfig);
    expect((provider as Record<string, unknown>).getDebugInfo).toBeUndefined();
  });

  it("exposes request info via getDebugInfo when debug is enabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeEasyshipRatesResponse([])));

    const provider = createEasyshipProvider({ ...baseConfig, debug: true });
    await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [defaultParcel],
      totalWeightGrams: 1500,
    });

    const debugInfo = (provider as Record<string, () => object>).getDebugInfo!();
    expect(debugInfo).toMatchObject({
      originPostalCode: "90210",
      destinationPostalCode: "10001",
      carriers: [],
      weightKg: 1.5,
    });
  });
});
