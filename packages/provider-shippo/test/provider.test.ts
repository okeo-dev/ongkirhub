import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  assertProviderConformance,
} from "@ongkirhub/core";
import { createShippoProvider } from "../src/provider.js";
import {
  loadShippoConfigFromEnv,
  requireShippoConfigFromEnv,
  validateShippoProviderConfig,
} from "../src/config.js";
import { mapShippoRatesToQuotes, parseEstimatedDuration } from "../src/quotes.js";

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
  weightGrams: 1000,
  dimensions: { lengthCm: 25.4, widthCm: 20.32, heightCm: 15.24 },
};

function makeShippoShipmentResponse(rates: unknown[], messages?: unknown[]) {
  const body = JSON.stringify({
    object_id: "shp_test",
    object_status: "SUCCESS",
    rates,
    messages: messages ?? [],
  });
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => ({
      object_id: "shp_test",
      object_status: "SUCCESS",
      rates,
      messages: messages ?? [],
    }),
  };
}

function makeShippoRate(overrides: Partial<import("../src/client.js").ShippoRate> = {}) {
  return {
    object_id: "rate_test",
    amount: "11.01",
    currency: "USD",
    provider: "USPS",
    servicelevel: {
      name: "Priority Mail",
      token: "usps_priority",
    },
    days: 2,
    ...overrides,
  };
}

describe("validateShippoProviderConfig", () => {
  it("requires apiKey", () => {
    expect(() =>
      validateShippoProviderConfig({
        apiKey: "",
        carriers: [],
      }),
    ).toThrow(ProviderError);

    expect(() =>
      validateShippoProviderConfig({
        apiKey: "",
        carriers: [],
      }),
    ).toThrow(/requires apiKey/);
  });

  it("applies default base URL", () => {
    const config = validateShippoProviderConfig({
      apiKey: "key",
      carriers: [],
    });
    expect(config.baseUrl).toBe("https://api.goshippo.com");
  });
});

describe("loadShippoConfigFromEnv", () => {
  it("returns undefined when no Shippo env vars are present", () => {
    expect(loadShippoConfigFromEnv({})).toBeUndefined();
  });

  it("parses all env vars correctly", () => {
    const config = loadShippoConfigFromEnv({
      SHIPPO_API_KEY: "test-key",
      SHIPPO_CARRIERS: "USPS, UPS",
      SHIPPO_BASE_URL: "https://example.com",
      SHIPPO_DEBUG: "true",
    });
    expect(config).toEqual({
      apiKey: "test-key",
      carriers: ["USPS", "UPS"],
      baseUrl: "https://example.com",
      debug: true,
    });
  });
});

describe("requireShippoConfigFromEnv", () => {
  it("throws when SHIPPO_API_KEY is missing", () => {
    expect(() => requireShippoConfigFromEnv({})).toThrow(
      /SHIPPO_API_KEY is required/,
    );
  });

  it("returns config when required fields are present", () => {
    const config = requireShippoConfigFromEnv({
      SHIPPO_API_KEY: "test-key",
      SHIPPO_CARRIERS: "USPS,UPS",
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

describe("mapShippoRatesToQuotes", () => {
  it("maps Shippo rates into normalized quotes", () => {
    const quotes = mapShippoRatesToQuotes([
      makeShippoRate({
        object_id: "rate_1",
        amount: "11.01",
        currency: "USD",
        provider: "USPS",
        servicelevel: { name: "Priority Mail", token: "usps_priority" },
        days: 2,
      }),
    ] as import("../src/client.js").ShippoRate[]);

    expect(quotes[0]).toMatchObject({
      providerKey: "shippo",
      serviceCode: "USPS-USPS_PRIORITY",
      serviceName: "USPS Priority Mail",
      price: { amount: 11.01, currency: "USD" },
      estimatedDuration: { value: 2, unit: "days" },
    });
  });

  it("filters rates by carrier when carrierFilter is provided", () => {
    const quotes = mapShippoRatesToQuotes(
      [
        makeShippoRate({
          object_id: "rate_1",
          provider: "USPS",
          servicelevel: { name: "Priority", token: "priority" },
        }),
        makeShippoRate({
          object_id: "rate_2",
          provider: "UPS",
          servicelevel: { name: "Ground", token: "ground" },
          amount: "12.50",
        }),
      ] as import("../src/client.js").ShippoRate[],
      { carrierFilter: ["USPS"] },
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.serviceCode).toBe("USPS-PRIORITY");
  });

  it("treats placeholder/sample test-mode rates as successful quote output", () => {
    const quotes = mapShippoRatesToQuotes(
      [
        makeShippoRate({
          object_id: "rate_sample",
          amount: "0.00",
          currency: "USD",
          provider: "SHIPO",
          servicelevel: { name: "Sample Rate", token: "sample" },
          test: true,
          days: 1,
        }),
      ] as import("../src/client.js").ShippoRate[],
    );

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price).toEqual({ amount: 0, currency: "USD" });
    expect(quotes[0]?.metadata).toMatchObject({ test: true });
  });
});

describe("createShippoProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls Shippo shipment endpoint with metric units", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeShippoShipmentResponse([
        makeShippoRate({
          object_id: "rate_1",
          amount: "11.01",
          currency: "USD",
          provider: "USPS",
          servicelevel: { name: "Priority Mail", token: "usps_priority" },
          days: 2,
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createShippoProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [defaultParcel],
      totalWeightGrams: 1000,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(11.01);

    const [url, requestInit] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.goshippo.com/shipments");
    expect(requestInit?.method).toBe("POST");
    const body = JSON.parse(requestInit?.body as string);
    expect(body.address_from).toMatchObject({
      country: "US",
      zip: "90210",
      state: "CA",
      city: "Beverly Hills",
    });
    expect(body.address_to).toMatchObject({
      country: "US",
      zip: "10001",
      state: "NY",
      city: "New York",
    });
    expect(body.parcels[0]).toMatchObject({
      weight: 1000,
      mass_unit: "g",
      length: 25.4,
      width: 20.32,
      height: 15.24,
      distance_unit: "cm",
    });

    const authHeader = (requestInit?.headers as Record<string, string>).authorization;
    expect(authHeader).toMatch(/^ShippoToken /);
  });

  it("throws when parcel dimensions are missing", async () => {
    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("throws when origin postal code is missing", async () => {
    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: { ...usOrigin, postalCode: undefined },
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws when destination postal code is missing", async () => {
    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: { ...usDestination, postalCode: undefined },
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws INVALID_REQUEST for cross-country routes without items", async () => {
    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: { ...usDestination, countryCode: "CA" },
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("accepts cross-country routes when request.items is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeShippoShipmentResponse([
        makeShippoRate({
          provider: "USPS",
          amount: "45.00",
          servicelevel: {
            name: "Priority Mail International",
            token: "usps_priority_international",
          },
          days: 5,
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createShippoProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: usOrigin,
      destination: { ...usDestination, countryCode: "CA", postalCode: "M5V 3A8", level1: "ON", level2: "Toronto" },
      parcels: [defaultParcel],
      totalWeightGrams: 1000,
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
      metadata: {
        shippo: {
          originLine1: "123 Example St",
          destinationLine1: "456 Maple Ave",
          originPhone: "+1-555-0100",
          destinationPhone: "+1-555-0200",
        },
      },
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(45.0);

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(requestInit?.body as string);
    expect(body.customs_declaration).toMatchObject({
      certify: true,
      certify_signer: "-",
      contents_type: "MERCHANDISE",
      items: [
        {
          description: "Handmade ceramic mug",
          quantity: 2,
          net_weight: "500",
          mass_unit: "g",
          value_amount: "25",
          value_currency: "USD",
          origin_country: "US",
          hs_code: "691200",
        },
      ],
    });
  });

  it("passes shippo metadata through request metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeShippoShipmentResponse([
        makeShippoRate({
          provider: "USPS",
          amount: "45.00",
          servicelevel: {
            name: "Priority Mail International",
            token: "usps_priority_international",
          },
          days: 5,
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createShippoProvider(baseConfig);
    await provider.getQuotes({
      origin: usOrigin,
      destination: { ...usDestination, countryCode: "CA", postalCode: "M5V 3A8", level1: "ON", level2: "Toronto" },
      parcels: [defaultParcel],
      totalWeightGrams: 1000,
      items: [
        {
          description: "Tea",
          quantity: 1,
          weightGrams: 200,
          declaredValue: { amount: 10, currency: "USD" },
        },
      ],
      metadata: {
        shippo: {
          originLine1: "123 Example St",
          destinationLine1: "456 Maple Ave",
          originPhone: "+1-555-0100",
          destinationPhone: "+1-555-0200",
          certify: true,
          certifySigner: "Jane Doe",
          contentsType: "GIFT",
          contentsExplanation: "Birthday gift",
          eelPfc: "NOEEI_30_37_A",
        },
      },
    });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(requestInit?.body as string);
    expect(body.address_from).toMatchObject({
      street1: "123 Example St",
      phone: "+1-555-0100",
    });
    expect(body.address_to).toMatchObject({
      street1: "456 Maple Ave",
      phone: "+1-555-0200",
    });
    expect(body.customs_declaration).toMatchObject({
      certify: true,
      certify_signer: "Jane Doe",
      contents_type: "GIFT",
      contents_explanation: "Birthday gift",
      eel_pfc: "NOEEI_30_37_A",
    });
  });

  it("maps upstream auth failures to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ detail: "Authentication credentials were not provided." }),
        json: async () => ({
          detail: "Authentication credentials were not provided.",
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
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
        text: async () => JSON.stringify({ messages: [{ source: "API", code: "429", text: "Rate limit exceeded" }] }),
        json: async () => ({
          messages: [{ source: "API", code: "429", text: "Rate limit exceeded" }],
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
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
        text: async () => JSON.stringify({ messages: [{ source: "API", code: "503", text: "Service unavailable" }] }),
        json: async () => ({
          messages: [{ source: "API", code: "503", text: "Service unavailable" }],
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("maps address failures to LOCATION_NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ messages: [{ source: "API", code: "400", text: "Invalid address: zip code not found" }] }),
        json: async () => ({
          messages: [
            {
              source: "API",
              code: "400",
              text: "Invalid address: zip code not found",
            },
          ],
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("maps invalid country to UNSUPPORTED_ROUTE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ messages: [{ source: "API", code: "400", text: "Country code XX is not supported" }] }),
        json: async () => ({
          messages: [
            {
              source: "API",
              code: "400",
              text: "Country code XX is not supported",
            },
          ],
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
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
        text: async () => JSON.stringify({ messages: [{ source: "API", code: "400", text: "Parcel weight is required" }] }),
        json: async () => ({
          messages: [
            {
              source: "API",
              code: "400",
              text: "Parcel weight is required",
            },
          ],
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("falls back to UNKNOWN_PROVIDER_FAILURE for unclassified 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 418,
        text: async () => JSON.stringify({ messages: [{ source: "API", code: "418", text: "I'm a teapot" }] }),
        json: async () => ({
          messages: [{ source: "API", code: "418", text: "I'm a teapot" }],
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_PROVIDER_FAILURE" });
  });

  it("surfaces soft errors on HTTP 200 when rates are empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            object_id: "shp_test",
            object_status: "ERROR",
            rates: [],
            messages: [{ source: "API", code: "400", text: "Parcel weight is required" }],
          }),
        json: async () => ({
          object_id: "shp_test",
          object_status: "ERROR",
          rates: [],
          messages: [
            {
              source: "API",
              code: "400",
              text: "Parcel weight is required",
            },
          ],
        }),
      }),
    );

    const provider = createShippoProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("ignores non-error messages on HTTP 200 when rates are present", async () => {
    const payload = {
      object_id: "shp_test",
      object_status: "SUCCESS",
      rates: [
        makeShippoRate({
          object_id: "rate_1",
          amount: "5.00",
          currency: "USD",
        }),
      ],
      messages: [{ source: "API", text: "Test mode: sample rates returned" }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
        json: async () => payload,
      }),
    );

    const provider = createShippoProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [defaultParcel],
      totalWeightGrams: 1000,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(5);
  });

  it("surfaces provider misconfiguration when requested carriers are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeShippoShipmentResponse([
          makeShippoRate({
            object_id: "rate_1",
            provider: "USPS",
            servicelevel: { name: "Priority", token: "priority" },
            amount: "11.01",
            currency: "USD",
          }),
        ]),
      ),
    );

    const provider = createShippoProvider({
      apiKey: "test-key",
      carriers: ["UPS"], // Requested UPS, but only USPS returned
    });

    await expect(
      provider.getQuotes({
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
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
        makeShippoShipmentResponse([
          makeShippoRate({
            object_id: "rate_1",
            amount: "11.01",
            currency: "USD",
            provider: "USPS",
            servicelevel: { name: "Priority Mail", token: "usps_priority" },
            days: 2,
          }),
        ]),
      ),
    );

    const provider = createShippoProvider(baseConfig);
    await assertProviderConformance(provider, {
      sampleRequest: {
        origin: usOrigin,
        destination: usDestination,
        parcels: [defaultParcel],
        totalWeightGrams: 1000,
      },
    });
  });

  it("throws INVALID_REQUEST when international metadata.shippo.originPhone is missing", async () => {
    const provider = createShippoProvider(baseConfig);
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
        totalWeightGrams: 1000,
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
        metadata: {
          shippo: {
            destinationLine1: "456 Maple Ave",
            destinationPhone: "+1-555-0200",
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      message: /metadata\.shippo\.originPhone/,
    });
  });

  it("throws INVALID_REQUEST when international items omit declaredValue", async () => {
    const provider = createShippoProvider(baseConfig);
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
        totalWeightGrams: 1000,
        items: [
          {
            description: "Handmade ceramic mug",
            quantity: 2,
            weightGrams: 500,
            hsCode: "691200",
            originCountryCode: "US",
          },
        ],
        metadata: {
          shippo: {
            originLine1: "123 Example St",
            destinationLine1: "456 Maple Ave",
            originPhone: "+1-555-0100",
            destinationPhone: "+1-555-0200",
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      message: /items\[0\]\.declaredValue/,
    });
  });

  it("does not expose getDebugInfo when debug is disabled", () => {
    const provider = createShippoProvider(baseConfig);
    expect((provider as Record<string, unknown>).getDebugInfo).toBeUndefined();
  });

  it("exposes request info via getDebugInfo when debug is enabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeShippoShipmentResponse([])));

    const provider = createShippoProvider({ ...baseConfig, debug: true });
    await provider.getQuotes({
      origin: usOrigin,
      destination: usDestination,
      parcels: [defaultParcel],
      totalWeightGrams: 1000,
    });

    const debugInfo = (provider as Record<string, () => object>).getDebugInfo!();
    expect(debugInfo).toMatchObject({
      originPostalCode: "90210",
      destinationPostalCode: "10001",
      carriers: [],
      weightGrams: 1000,
    });
  });
});
