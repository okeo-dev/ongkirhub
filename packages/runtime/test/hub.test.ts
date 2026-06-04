import { describe, expect, it } from "vitest";
import { ProviderError } from "@ongkirhub/core";
import { createOngkirHub } from "../src/hub.js";

function makeProvider(
  key: string,
  quoteFn?: (request: { totalWeightGrams: number }) => ReturnType<typeof makeProvider>["getQuotes"],
) {
  return {
    key,
    name: key,
    capabilities: {
      coverage: ["domestic"] as const,
      dimensionsRequired: false,
      codSupported: false,
      serviceFilteringSupported: false,
    },
    async getQuotes(request: { totalWeightGrams: number }) {
      if (quoteFn) return quoteFn(request);
      return [
        {
          providerKey: key,
          serviceCode: "REG",
          serviceName: `${key} Regular`,
          price: { amount: 10000, currency: "IDR" },
          estimatedDuration: { value: 2, unit: "days" },
          metadata: {},
        },
      ];
    },
  };
}

describe("createOngkirHub", () => {
  it("returns health with sorted provider keys", () => {
    const hub = createOngkirHub({
      providers: [makeProvider("mock"), makeProvider("manual")],
    });
    expect(hub.getHealth()).toEqual({
      status: "ok",
      providers: ["manual", "mock"],
    });
  });

  it("gets quotes from all providers by default", async () => {
    const hub = createOngkirHub({
      providers: [makeProvider("mock"), makeProvider("manual")],
    });

    const result = await hub.getQuotes({
      origin: { method: "location", countryCode: "ID", level1: "A", level2: "B" },
      destination: { method: "location", countryCode: "ID", level1: "C", level2: "D" },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    expect(result.quotes).toHaveLength(2);
    expect(result.providers).toEqual(["mock", "manual"]);
  });

  it("filters providers when provider keys are given", async () => {
    const hub = createOngkirHub({
      providers: [makeProvider("mock"), makeProvider("manual")],
    });

    const result = await hub.getQuotes(
      {
        origin: { method: "location", countryCode: "ID", level1: "A", level2: "B" },
        destination: { method: "location", countryCode: "ID", level1: "C", level2: "D" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      },
      { providers: "mock" },
    );

    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]?.providerKey).toBe("mock");
  });

  it("throws provider errors from individual providers", async () => {
    const failingProvider = {
      ...makeProvider("fail"),
      async getQuotes() {
        throw new ProviderError("UPSTREAM_UNAVAILABLE", "Provider is down", {
          providerKey: "fail",
        });
      },
    };

    const hub = createOngkirHub({
      providers: [makeProvider("mock"), failingProvider],
    });

    await expect(
      hub.getQuotes({
        origin: { method: "location", countryCode: "ID", level1: "A", level2: "B" },
        destination: { method: "location", countryCode: "ID", level1: "C", level2: "D" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });

  it("throws structured error for invalid request before provider dispatch", async () => {
    const hub = createOngkirHub({
      providers: [makeProvider("mock")],
    });

    await expect(
      hub.getQuotes({
        origin: { method: "location", countryCode: "ID" },
        destination: { method: "location", countryCode: "ID", level1: "C", level2: "D" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      } as any),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("throws when no providers are configured", async () => {
    const hub = createOngkirHub({ providers: [] });

    await expect(
      hub.getQuotes({
        origin: { method: "location", countryCode: "ID", level1: "A", level2: "B" },
        destination: { method: "location", countryCode: "ID", level1: "C", level2: "D" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST", message: "No providers configured" });
  });

  it("collects debug metadata when providers expose it", async () => {
    const debugProvider = {
      ...makeProvider("debug"),
      getDebugInfo: () => ({ originId: "123", destinationId: "456" }),
    };

    const hub = createOngkirHub({
      providers: [debugProvider],
    });

    const result = await hub.getQuotes({
      origin: { method: "location", countryCode: "ID", level1: "A", level2: "B" },
      destination: { method: "location", countryCode: "ID", level1: "C", level2: "D" },
      parcels: [{ weightGrams: 1000 }],
      totalWeightGrams: 1000,
    });

    expect(result.debug).toBeDefined();
    expect(result.debug).toMatchObject({
      debug: { originId: "123", destinationId: "456" },
    });
  });
});
