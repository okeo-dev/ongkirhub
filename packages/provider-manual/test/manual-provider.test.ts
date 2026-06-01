import { describe, expect, it } from "vitest";
import { assertProviderConformance } from "@ongkirhub/core";
import { createManualProvider } from "../src/index.js";

describe("manual provider", () => {
  it("conforms to the core provider contract", async () => {
    await assertProviderConformance(
      createManualProvider({
        services: [
          {
            serviceCode: "REG",
            serviceName: "Regular",
            basePrice: 10000,
            currency: "IDR",
            estimatedDuration: { value: 2, unit: "days" },
          },
        ],
      }),
    );
  });

  it("applies weight-based pricing rules", async () => {
    const provider = createManualProvider({
      services: [
        {
          serviceCode: "REG",
          serviceName: "Regular",
          basePrice: 10000,
          currency: "IDR",
          pricePerKg: 2000,
          estimatedDuration: { value: 2, unit: "days" },
        },
      ],
    });

    const light = await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Jakarta Pusat",
      },
      destination: {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Timur",
        level2: "Surabaya",
      },
      parcels: [{ weightGrams: 500 }],
      totalWeightGrams: 500,
    });

    const heavy = await provider.getQuotes({
      origin: {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Jakarta Pusat",
      },
      destination: {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Timur",
        level2: "Surabaya",
      },
      parcels: [{ weightGrams: 2000 }],
      totalWeightGrams: 2000,
    });

    expect(light[0]?.price.amount).toBe(12000);
    expect(heavy[0]?.price.amount).toBe(14000);
  });
});
