import { describe, expect, it } from "vitest";
import { assertProviderConformance } from "@ongkirhub/core";
import { createMockProvider } from "../src/index.js";

describe("mock provider", () => {
  it("conforms to the core provider contract", async () => {
    await assertProviderConformance(createMockProvider());
  });

  it("returns deterministic quotes for the same route", async () => {
    const provider = createMockProvider();
    const request = {
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Jakarta Pusat",
      },
      destination: {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Barat",
        level2: "Bandung",
      },
      parcels: [{ weightGrams: 1500 }],
      totalWeightGrams: 1500,
    };

    const first = await provider.getQuotes(request);
    const second = await provider.getQuotes(request);

    expect(first).toEqual(second);
  });
});
