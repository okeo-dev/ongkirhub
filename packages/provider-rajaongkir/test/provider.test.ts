import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  assertProviderConformance,
  type ProviderLocationRecord,
} from "@ongkirhub/core";
import { compileYamlSourceToRecords } from "../src/location/compile.js";
import { createRajaOngkirProvider } from "../src/provider.js";
import { validateRajaOngkirProviderConfig } from "../src/config.js";
import {
  mapRajaOngkirCostsToQuotes,
  mapRajaOngkirInternationalCostsToQuotes,
  parseEstimatedDuration,
} from "../src/quotes.js";

const syntheticYaml = `
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p6"
        name: DKI JAKARTA
        children:
          - providerId: "c1"
            name: KOTA JAKARTA BARAT
            aliases:
              - JAKARTA BARAT
            children:
              - providerId: "d1"
                name: GROGOL PETAMBURAN
                children:
                  - providerId: "2088"
                    name: GROGOL
                  - providerId: "2089"
                    name: JELAMBAR
      - providerId: "p9"
        name: JAWA BARAT
        children:
          - providerId: "c23"
            name: KOTA BANDUNG
            aliases:
              - BANDUNG
            children:
              - providerId: "d2"
                name: COBLONG
                children:
                  - providerId: "356"
                    name: CICADAS
`;

const records: ProviderLocationRecord[] = compileYamlSourceToRecords(syntheticYaml);

const baseConfig = {
  apiKey: "test-api-key",
  couriers: ["jne", "tiki"],
  records,
};

describe("validateRajaOngkirProviderConfig", () => {
  it("requires apiKey, couriers, and records", () => {
    expect(() =>
      validateRajaOngkirProviderConfig({
        apiKey: "",
        couriers: ["jne"],
        records,
      }),
    ).toThrow(ProviderError);

    expect(() =>
      validateRajaOngkirProviderConfig({
        apiKey: "key",
        couriers: [],
        records,
      }),
    ).toThrow(/at least one courier/);

    expect(() =>
      validateRajaOngkirProviderConfig({
        apiKey: "key",
        couriers: ["jne"],
        records: [],
      }),
    ).toThrow(/location mapping records/);
  });
});

describe("parseEstimatedDuration", () => {
  it("parses day and hour ranges conservatively", () => {
    expect(parseEstimatedDuration("1-2 day")).toEqual({
      value: 1,
      unit: "days",
    });
    expect(parseEstimatedDuration("5 day")).toEqual({
      value: 5,
      unit: "days",
    });
    expect(parseEstimatedDuration("12-24 hour")).toEqual({
      value: 12,
      unit: "hours",
    });
  });
});

describe("createRajaOngkirProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps RajaOngkir costs into OngkirHub quotes", () => {
    const quotes = mapRajaOngkirCostsToQuotes([
      {
        name: "JNE",
        code: "jne",
        service: "REG",
        description: "JNE Regular",
        cost: 15000,
        etd: "2-3 day",
      },
    ]);

    expect(quotes[0]).toMatchObject({
      providerKey: "rajaongkir",
      serviceCode: "JNE-REG",
      serviceName: "JNE REG",
      price: { amount: 15000, currency: "IDR" },
      estimatedDuration: { value: 2, unit: "days" },
      metadata: { courierCode: "jne", description: "JNE Regular", rawEtd: "2-3 day" },
    });
  });

  it("resolves subdistricts and calls RajaOngkir with mocked HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        meta: { status: "success", code: 200 },
        data: [
          {
            name: "JNE",
            code: "jne",
            service: "REG",
            description: "JNE Regular",
            cost: 12000,
            etd: "1 day",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createRajaOngkirProvider(baseConfig);
    const quotes = await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
        level4: "Grogol",
      },
      destination: {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Barat",
        level2: "Kota Bandung",
        level3: "Coblong",
        level4: "Cicadas",
      },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(12000);

    const [url, requestInit] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/calculate\/domestic-cost$/);
    const body = new URLSearchParams(requestInit?.body as string);
    expect(body.get("origin")).toBe("2088");
    expect(body.get("destination")).toBe("356");
    expect(body.get("weight")).toBe("1000");
    expect(body.get("courier")).toBe("jne:tiki");
  });

  it("maps upstream auth failures to ProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          meta: { message: "Invalid API key", code: 401, status: "error" },
        }),
      }),
    );

    const provider = createRajaOngkirProvider(baseConfig);

    await expect(
      provider.getQuotes({
        origin: {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Kota Jakarta Barat",
          level3: "Grogol Petamburan",
          level4: "Grogol",
        },
        destination: {
          method: "location",
          countryCode: "ID",
          level1: "Jawa Barat",
          level2: "Kota Bandung",
          level3: "Coblong",
          level4: "Cicadas",
        },
        parcels: [{ weightGrams: 500 }],
        totalWeightGrams: 500,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_AUTH_FAILURE" });
  });

  it("passes provider conformance with mocked upstream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          meta: { status: "success", code: 200 },
          data: [
            {
              name: "TIKI",
              code: "tiki",
              service: "REG",
              description: "TIKI Regular",
              cost: 9000,
              etd: "2 day",
            },
          ],
        }),
      }),
    );

    const provider = createRajaOngkirProvider(baseConfig);
    await assertProviderConformance(provider, {
      sampleRequest: {
        origin: {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Kota Jakarta Barat",
          level3: "Grogol Petamburan",
          level4: "Grogol",
        },
        destination: {
          method: "location",
          countryCode: "ID",
          level1: "Jawa Barat",
          level2: "Kota Bandung",
          level3: "Coblong",
          level4: "Cicadas",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      },
    });
  });

  it("does not expose getDebugInfo when debug is disabled", () => {
    const provider = createRajaOngkirProvider(baseConfig);
    expect((provider as Record<string, unknown>).getDebugInfo).toBeUndefined();
  });

  it("exposes resolved IDs via getDebugInfo when debug is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          meta: { status: "success", code: 200 },
          data: [],
        }),
      }),
    );

    const provider = createRajaOngkirProvider({ ...baseConfig, debug: true });
    await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
        level4: "Grogol",
      },
      destination: {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Barat",
        level2: "Kota Bandung",
        level3: "Coblong",
        level4: "Cicadas",
      },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    const debugInfo = (provider as Record<string, () => object>).getDebugInfo!();
    expect(debugInfo).toMatchObject({
      originId: "2088",
      destinationId: "356",
      weightGrams: 1000,
      couriers: ["jne", "tiki"],
    });
  });

  it("rejects non-Indonesia origin with UNSUPPORTED_ROUTE", async () => {
    const provider = createRajaOngkirProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: {
          method: "location",
          countryCode: "SG",
          postalCode: "123456",
        },
        destination: {
          method: "location",
          countryCode: "MY",
          postalCode: "50000",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_ROUTE",
      message: /Indonesia-origin/,
    });
  });

  it("routes ID → non-ID to international flow with mocked HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        meta: { status: "success", code: 200 },
        data: [
          {
            name: "Rayspeed Indonesia",
            code: "ray",
            service: "Regular Service",
            description: "Retail",
            currency: "IDR",
            cost: 55000,
            etd: "2-3 day",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createRajaOngkirProvider({
      ...baseConfig,
      internationalCouriers: ["ray", "lion"],
    });
    const quotes = await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
        level4: "Grogol",
      },
      destination: {
        method: "location",
        countryCode: "MY",
        postalCode: "50000",
      },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      providerKey: "rajaongkir",
      serviceCode: "RAY-REGULAR SERVICE",
      serviceName: "Rayspeed Indonesia Regular Service",
      price: { amount: 55000, currency: "IDR" },
      estimatedDuration: { value: 2, unit: "days" },
      metadata: { courierCode: "ray", currency: "IDR" },
    });

    const [url, requestInit] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/calculate\/international-cost$/);
    const body = new URLSearchParams(requestInit?.body as string);
    expect(body.get("origin")).toBe("2088");
    expect(body.get("destination")).toBe("108");
    expect(body.get("weight")).toBe("1000");
    expect(body.get("courier")).toBe("ray:lion");
  });

  it("falls back to domestic couriers when internationalCouriers is not set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          meta: { status: "success", code: 200 },
          data: [],
        }),
      }),
    );

    const provider = createRajaOngkirProvider(baseConfig);
    await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
        level4: "Grogol",
      },
      destination: {
        method: "location",
        countryCode: "SG",
        postalCode: "123456",
      },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    const [, requestInit] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = new URLSearchParams(requestInit?.body as string);
    expect(body.get("courier")).toBe("jne:tiki");
  });

  it("throws LOCATION_NOT_FOUND for unsupported destination country", async () => {
    const provider = createRajaOngkirProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Kota Jakarta Barat",
          level3: "Grogol Petamburan",
          level4: "Grogol",
        },
        destination: {
          method: "location",
          countryCode: "XZ",
          postalCode: "00000",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({
      code: "LOCATION_NOT_FOUND",
      message: /does not support shipping to country/,
    });
  });

  it("maps international costs into normalized quotes", () => {
    const quotes = mapRajaOngkirInternationalCostsToQuotes([
      {
        name: "Lion Parcel",
        code: "lion",
        service: "INTERPACK",
        description: "Active",
        currency: "IDR",
        cost: 65000,
        etd: "5-7 day",
      },
    ]);

    expect(quotes[0]).toMatchObject({
      providerKey: "rajaongkir",
      serviceCode: "LION-INTERPACK",
      serviceName: "Lion Parcel INTERPACK",
      price: { amount: 65000, currency: "IDR" },
      estimatedDuration: { value: 5, unit: "days" },
      metadata: { courierCode: "lion", currency: "IDR" },
    });
  });

  it("exposes international debug info when debug is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          meta: { status: "success", code: 200 },
          data: [],
        }),
      }),
    );

    const provider = createRajaOngkirProvider({
      ...baseConfig,
      debug: true,
      internationalCouriers: ["ray"],
    });
    await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
        level4: "Grogol",
      },
      destination: {
        method: "location",
        countryCode: "MY",
        postalCode: "50000",
      },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    const debugInfo = (provider as Record<string, () => object>).getDebugInfo!();
    expect(debugInfo).toMatchObject({
      route: "international",
      originId: "2088",
      destinationCountryId: "108",
      destinationCountryCode: "MY",
      weightGrams: 1000,
      couriers: ["ray"],
    });
  });
});

describe("provider-level destination sufficiency", () => {
  it("domestic RajaOngkir still rejects countryCode-only destination", async () => {
    const provider = createRajaOngkirProvider(baseConfig);
    await expect(
      provider.getQuotes({
        origin: {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Kota Jakarta Barat",
          level3: "Grogol Petamburan",
          level4: "Grogol",
        },
        destination: {
          method: "location",
          countryCode: "ID",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({
      code: "LOCATION_NOT_FOUND",
    });
  });
});
