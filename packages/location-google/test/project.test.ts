import { describe, expect, it } from "vitest";
import { toLocationInput } from "../src/project.js";

function makeNormalized(overrides: Partial<Parameters<typeof toLocationInput>[0]> = {}) {
  return {
    countryCode: "ID",
    postalCode: "11460",
    level1: "DKI Jakarta",
    level2: "Jakarta Barat",
    level3: "Grogol Petamburan",
    level4: "Jelambar",
    latitude: -6.162,
    longitude: 106.789,
    formattedAddress: "Jelambar, Jakarta Barat",
    source: { provider: "google" as const, placeId: "ChIJ12345", types: [] },
    ...overrides,
  };
}

describe("toLocationInput", () => {
  it('"hierarchy" (default) includes level1-level4 and omits postalCode', () => {
    const result = toLocationInput(makeNormalized());

    expect(result).toEqual({
      method: "location",
      countryCode: "ID",
      level1: "DKI Jakarta",
      level2: "Jakarta Barat",
      level3: "Grogol Petamburan",
      level4: "Jelambar",
    });
    expect(result).not.toHaveProperty("postalCode");
  });

  it('"hierarchy" explicitly omits postalCode even when present', () => {
    const result = toLocationInput(makeNormalized(), { resultType: "hierarchy" });

    expect(result.postalCode).toBeUndefined();
  });

  it('"postalCode" includes postalCode and omits hierarchy', () => {
    const result = toLocationInput(makeNormalized(), { resultType: "postalCode" });

    expect(result).toEqual({
      method: "location",
      countryCode: "ID",
      postalCode: "11460",
    });
    expect(result).not.toHaveProperty("level1");
    expect(result).not.toHaveProperty("level2");
  });

  it('"postalCode" still works when postalCode is missing', () => {
    const result = toLocationInput(makeNormalized({ postalCode: null }), {
      resultType: "postalCode",
    });

    expect(result).toEqual({
      method: "location",
      countryCode: "ID",
    });
  });

  it('"full" includes both postalCode and hierarchy', () => {
    const result = toLocationInput(makeNormalized(), { resultType: "full" });

    expect(result).toEqual({
      method: "location",
      countryCode: "ID",
      postalCode: "11460",
      level1: "DKI Jakarta",
      level2: "Jakarta Barat",
      level3: "Grogol Petamburan",
      level4: "Jelambar",
    });
  });

  it('"full" omits missing fields gracefully', () => {
    const result = toLocationInput(
      makeNormalized({
        postalCode: null,
        level3: null,
        level4: null,
      }),
      { resultType: "full" },
    );

    expect(result).toEqual({
      method: "location",
      countryCode: "ID",
      level1: "DKI Jakarta",
      level2: "Jakarta Barat",
    });
    expect(result).not.toHaveProperty("postalCode");
    expect(result).not.toHaveProperty("level3");
  });

  it("throws when countryCode is missing", () => {
    expect(() =>
      toLocationInput(makeNormalized({ countryCode: null })),
    ).toThrow(/missing countryCode/);
  });
});
