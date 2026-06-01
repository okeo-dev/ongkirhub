import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderError,
  assertProviderConformance,
  type ProviderLocationRecord,
} from "@ongkirhub/core";
import { compileYamlSourceToRecords } from "../src/location/compile.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRajaOngkirProvider } from "../src/provider.js";
import { validateRajaOngkirProviderConfig } from "../src/config.js";
import { mapRajaOngkirCostsToQuotes, parseEstimatedDuration } from "../src/quotes.js";

const records: ProviderLocationRecord[] = compileYamlSourceToRecords(
  readFileSync(
    join(import.meta.dirname, "../src/location/source/locations.yaml"),
    "utf8",
  ),
);

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
      price: { amount: 15000, currency: "IDR" },
      estimatedDuration: { value: 2, unit: "days" },
      metadata: { courierCode: "jne", rawEtd: "2-3 day" },
    });
  });

  it("resolves districts and calls RajaOngkir with mocked HTTP", async () => {
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
      },
      destination: {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Barat",
        level2: "Kota Bandung",
        level3: "Coblong",
      },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    expect(quotes).toHaveLength(1);
    expect(quotes[0]?.price.amount).toBe(12000);

    const [, requestInit] = fetchMock.mock.calls[0]!;
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
        },
        destination: {
          method: "location",
          countryCode: "ID",
          level1: "Jawa Barat",
          level2: "Kota Bandung",
          level3: "Coblong",
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
          level2: "Jakarta Pusat",
          level3: "Menteng",
        },
        destination: {
          method: "location",
          countryCode: "ID",
          level1: "Jawa Barat",
          level2: "Kota Bandung",
          level3: "Coblong",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      },
    });
  });
});
