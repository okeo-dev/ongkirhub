import { describe, expect, it } from "vitest";
import {
  assertProviderConformance,
  type Quote,
  type QuoteRequest,
  type ShippingProvider,
} from "../src/index.js";

function createStubProvider(
  quotes: Quote[],
  overrides: Partial<ShippingProvider> = {},
): ShippingProvider {
  return {
    key: "stub",
    name: "Stub Provider",
    capabilities: {
      coverage: ["domestic"],
      dimensionsRequired: false,
      codSupported: false,
      serviceFilteringSupported: false,
    },
    async getQuotes() {
      return quotes;
    },
    ...overrides,
  };
}

describe("assertProviderConformance", () => {
  it("accepts a valid provider implementation", async () => {
    const provider = createStubProvider([
      {
        providerKey: "stub",
        serviceCode: "REG",
        serviceName: "Regular",
        price: { amount: 15000, currency: "IDR" },
        estimatedDuration: { value: 2, unit: "days" },
      },
    ]);

    await expect(assertProviderConformance(provider)).resolves.toBeUndefined();
  });

  it("rejects quotes with mismatched providerKey", async () => {
    const provider = createStubProvider([
      {
        providerKey: "other",
        serviceCode: "REG",
        serviceName: "Regular",
        price: { amount: 15000, currency: "IDR" },
        estimatedDuration: { value: 2, unit: "days" },
      },
    ]);

    await expect(assertProviderConformance(provider)).rejects.toThrow(
      /providerKey/,
    );
  });

  it("validates custom sample requests", async () => {
    const provider = createStubProvider([]);
    const invalidRequest = {
      origin: { city: "Jakarta" },
      destination: { city: "Bandung" },
      parcels: [],
      totalWeightGrams: 1000,
    } as QuoteRequest;

    await expect(
      assertProviderConformance(provider, { sampleRequest: invalidRequest }),
    ).rejects.toThrow(/parcels/);
  });
});
