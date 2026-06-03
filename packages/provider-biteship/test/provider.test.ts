import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  assertProviderConformance,
} from "@ongkirhub/core";
import { createBiteshipProvider } from "../src/provider.js";
import {
  loadBiteshipConfigFromEnv,
  requireBiteshipConfigFromEnv,
  validateBiteshipProviderConfig,
} from "../src/config.js";
import { mapBiteshipPricingToQuotes, parseEstimatedDuration } from "../src/quotes.js";

const baseConfig = {
  apiKey: "test-api-key",
  couriers: ["jne", "sicepat"],
};

describe("validateBiteshipProviderConfig", () => {
  it("requires apiKey and couriers", () => {
    expect(() =>
      validateBiteshipProviderConfig({
        apiKey: "",
        couriers: ["jne"],
      }),
    ).toThrow(ProviderError);

    expect(() =>
      validateBiteshipProviderConfig({
        apiKey: "key",
        couriers: [],
      }),
    ).toThrow(/at least one courier/);
  });
});

describe("loadBiteshipConfigFromEnv", () => {
  it("returns undefined when no Biteship env vars are present", () => {
    const config = loadBiteshipConfigFromEnv({});
    expect(config).toBeUndefined();
  });

  it("parses all env vars correctly", () => {
    const config = loadBiteshipConfigFromEnv({
      BITESHIP_API_KEY: "test-key",
      BITESHIP_COURIERS: "jne, sicepat",
      BITESHIP_BASE_URL: "https://example.com",
      BITESHIP_DEBUG: "true",
    });
    expect(config).toEqual({
      apiKey: "test-key",
      couriers: ["jne", "sicepat"],
      baseUrl: "https://example.com",
      debug: true,
    });
  });
});

describe("requireBiteshipConfigFromEnv", () => {
  it("throws when BITESHIP_API_KEY is missing", () => {
    expect(() =>
      requireBiteshipConfigFromEnv({ BITESHIP_COURIERS: "jne" }),
    ).toThrow(/BITESHIP_API_KEY is required/);
  });

  it("throws when BITESHIP_COURIERS is missing", () => {
    expect(() =>
      requireBiteshipConfigFromEnv({ BITESHIP_API_KEY: "key" }),
    ).toThrow(/BITESHIP_COURIERS is required/);
  });

  it("returns config when required fields are present", () => {
    const config = requireBiteshipConfigFromEnv({
      BITESHIP_API_KEY: "test-key",
      BITESHIP_COURIERS: "jne,sicepat",
    });
    expect(config).toEqual({
      apiKey: "test-key",
      couriers: ["jne", "sicepat"],
      debug: false,
    });
  });
});

describe("parseEstimatedDuration", () => {
  it("parses day ranges", () => {
    expect(parseEstimatedDuration("2 - 3 days")).toEqual({ value: 2, unit: "days" });
    expect(parseEstimatedDuration("1 day")).toEqual({ value: 1, unit: "days" });
  });

  it("parses hour ranges", () => {
    expect(parseEstimatedDuration("12 - 24 hours")).toEqual({ value: 12, unit: "hours" });
    expect(parseEstimatedDuration("5 hours")).toEqual({ value: 5, unit: "hours" });
  });
});

describe("createBiteshipProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Biteship pricing into normalized quotes", () => {
    const quotes = mapBiteshipPricingToQuotes([
      {
        company: "jne",
        courier_name: "JNE",
        courier_code: "jne",
        courier_service_name: "Reguler",
        courier_service_code: "reg",
        currency: "IDR",
        description: "Layanan reguler",
        duration: "2 - 3 days",
        shipment_duration_range: "2 - 3",
        shipment_duration_unit: "days",
        service_type: "standard",
        shipping_type: "parcel",
        price: 15000,
        shipping_fee: 15000,
        shipping_fee_discount: 0,
        shipping_fee_surcharge: 0,
        insurance_fee: 0,
        cash_on_delivery_fee: 0,
      },
    ]);

    expect(quotes[0]).toMatchObject({
      providerKey: "biteship",
      serviceCode: "JNE-REG",
      serviceName: "JNE Reguler",
      price: { amount: 15000, currency: "IDR" },
      estimatedDuration: { value: 2, unit: "days" },
      metadata: {
        courierCode: "jne",
        courierName: "JNE",
        serviceCode: "reg",
        serviceName: "Reguler",
      },
    });
  });

  it("calls Biteship with postal codes and mocked HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: "Success",
        code: 20001007,
        pricing: [
          {
            company: "jne",
            courier_name: "JNE",
            courier_code: "jne",
            courier_service_name: "Reguler",
            courier_service_code: "reg",
            currency: "IDR",
            description: "Layanan reguler",
            duration: "1 day",
            shipment_duration_range: "1",
            shipment_duration_unit: "days",
            service_type: "standard",
            shipping_type: "parcel",
            price: 12000,
            shipping_fee: 12000,
            shipping_fee_discount: 0,
            shipping_fee_surcharge: 0,
            insurance_fee: 0,
            cash_on_delivery_fee: 0,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createBiteshipProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        postalCode: "12440",
        level1: "DKI Jakarta",
        level2: "Jakarta Selatan",
      },
      destination: {
        method: "location",
        countryCode: "ID",
        postalCode: "12240",
        level1: "DKI Jakarta",
        level2: "Jakarta Pusat",
      },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(12000);

    const [url, requestInit] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.biteship.com/v1/rates/couriers");
    const body = JSON.parse(requestInit?.body as string);
    expect(body.origin_postal_code).toBe(12440);
    expect(body.destination_postal_code).toBe(12240);
    expect(body.couriers).toBe("jne,sicepat");
    expect(body.items[0].weight).toBe(1000);
  });

  it("throws when origin postal code is missing", async () => {
    const provider = createBiteshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Jakarta Selatan",
        },
        destination: {
          method: "location",
          countryCode: "ID",
          postalCode: "12240",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws when destination postal code is missing", async () => {
    const provider = createBiteshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: {
          method: "location",
          countryCode: "ID",
          postalCode: "12440",
        },
        destination: {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Jakarta Pusat",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "LOCATION_NOT_FOUND" });
  });

  it("throws for non-Indonesia routes", async () => {
    const provider = createBiteshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: { method: "location", countryCode: "ID", postalCode: "12440" },
        destination: { method: "location", countryCode: "SG", postalCode: "123456" },
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
        json: async () => ({ success: false, message: "Invalid API key" }),
      }),
    );

    const provider = createBiteshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: { method: "location", countryCode: "ID", postalCode: "12440" },
        destination: { method: "location", countryCode: "ID", postalCode: "12240" },
        parcels: [{ weightGrams: 500 }],
        totalWeightGrams: 500,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_AUTH_FAILURE" });
  });

  it("surfaces upstream error payload text when Biteship returns error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: "No sufficient balance to call rates API. Please top up your balance",
        }),
      }),
    );

    const provider = createBiteshipProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: { method: "location", countryCode: "ID", postalCode: "12440" },
        destination: { method: "location", countryCode: "ID", postalCode: "12240" },
        parcels: [{ weightGrams: 500 }],
        totalWeightGrams: 500,
      }),
    ).rejects.toMatchObject({
      code: "UNKNOWN_PROVIDER_FAILURE",
      message: "No sufficient balance to call rates API. Please top up your balance",
    });
  });

  it("passes provider conformance with mocked upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          pricing: [
            {
              company: "jne",
              courier_name: "JNE",
              courier_code: "jne",
              courier_service_name: "Reguler",
              courier_service_code: "reg",
              currency: "IDR",
              description: "Layanan reguler",
              duration: "2 day",
              shipment_duration_range: "2",
              shipment_duration_unit: "days",
              service_type: "standard",
              shipping_type: "parcel",
              price: 9000,
              shipping_fee: 9000,
              shipping_fee_discount: 0,
              shipping_fee_surcharge: 0,
              insurance_fee: 0,
              cash_on_delivery_fee: 0,
            },
          ],
        }),
      }),
    );

    const provider = createBiteshipProvider(baseConfig);
    await assertProviderConformance(provider, {
      sampleRequest: {
        origin: { method: "location", countryCode: "ID", postalCode: "12440" },
        destination: { method: "location", countryCode: "ID", postalCode: "12240" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      },
    });
  });

  it("does not expose getDebugInfo when debug is disabled", () => {
    const provider = createBiteshipProvider(baseConfig);
    expect((provider as Record<string, unknown>).getDebugInfo).toBeUndefined();
  });

  it("exposes request info via getDebugInfo when debug is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, pricing: [] }),
      }),
    );

    const provider = createBiteshipProvider({ ...baseConfig, debug: true });
    await provider.getQuotes({
      origin: { method: "location", countryCode: "ID", postalCode: "12440" },
      destination: { method: "location", countryCode: "ID", postalCode: "12240" },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    const debugInfo = (provider as Record<string, () => object>).getDebugInfo!();
    expect(debugInfo).toMatchObject({
      originPostalCode: "12440",
      destinationPostalCode: "12240",
      couriers: ["jne", "sicepat"],
    });
  });
});
