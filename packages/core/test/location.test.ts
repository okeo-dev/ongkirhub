import { describe, expect, it } from "vitest";
import {
  compileMappingDocumentToRecords,
  LocationError,
  normalizeLocationToken,
  resolveLocation,
  validateLocationInput,
} from "../src/index.js";

const sampleDocument = {
  provider: "sample",
  version: "1",
  countries: [
    {
      countryCode: "ID",
      nodes: [
        {
          providerId: "jkt",
          name: "DKI Jakarta",
          aliases: ["Jakarta"],
          children: [
            {
              providerId: "jkt-barat",
              name: "Jakarta Barat",
              postalCodes: ["11460"],
              children: [
                {
                  providerId: "grogol",
                  name: "Grogol Petamburan",
                },
                {
                  providerId: "kembangan",
                  name: "Kembangan",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("validateLocationInput", () => {
  it("accepts countryCode with postalCode", () => {
    const input = validateLocationInput(
      { method: "location", countryCode: "id", postalCode: "11460" },
      "origin",
    );
    expect(input).toEqual({
      method: "location",
      countryCode: "ID",
      postalCode: "11460",
    });
  });

  it("accepts countryCode with level1 and level2", () => {
    const input = validateLocationInput(
      {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Jakarta Barat",
      },
      "destination",
    );
    expect(input.level2).toBe("Jakarta Barat");
  });

  it("rejects countryCode-only origin input", () => {
    expect(() =>
      validateLocationInput(
        { method: "location", countryCode: "ID" },
        "origin",
        "origin",
      ),
    ).toThrow(/postalCode or both level1 and level2/);
  });

  it("accepts countryCode-only destination input", () => {
    const input = validateLocationInput(
      { method: "location", countryCode: "my" },
      "destination",
      "destination",
    );
    expect(input).toEqual({
      method: "location",
      countryCode: "MY",
    });
  });

  it("defaults to origin strictness when role is omitted", () => {
    expect(() =>
      validateLocationInput(
        { method: "location", countryCode: "ID" },
        "origin",
      ),
    ).toThrow(/postalCode or both level1 and level2/);
  });

  it("rejects skipped hierarchy", () => {
    expect(() =>
      validateLocationInput(
        {
          method: "location",
          countryCode: "ID",
          level2: "Jakarta Barat",
        },
        "origin",
      ),
    ).toThrow(/level2 requires .*level1/);
  });

  it("rejects coordinate method at framework validation", () => {
    expect(() =>
      validateLocationInput(
        { method: "coordinate", latitude: -6.1, longitude: 106.8 },
        "origin",
      ),
    ).toThrow(/coordinate input is not supported/);
  });
});

describe("normalizeLocationToken", () => {
  it("trims, uppercases, collapses spaces, and removes punctuation", () => {
    expect(normalizeLocationToken("  DKI   Jakarta!! ")).toBe("DKI JAKARTA");
  });
});

describe("compileMappingDocumentToRecords", () => {
  it("always exposes normalized alias arrays on runtime records", () => {
    const records = compileMappingDocumentToRecords(sampleDocument);
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(Array.isArray(record.normalizedAliases)).toBe(true);
    }
    const jakarta = records.find((record) => record.providerId === "jkt");
    expect(jakarta?.normalizedAliases).toEqual(["JAKARTA"]);
    const barat = records.find((record) => record.providerId === "jkt-barat");
    expect(barat?.normalizedAliases).toEqual([]);
  });
});

describe("resolveLocation", () => {
  const records = compileMappingDocumentToRecords(sampleDocument);

  it("resolves a unique postal and hierarchy match", () => {
    const result = resolveLocation(
      {
        method: "location",
        countryCode: "ID",
        postalCode: "11460",
        level1: "DKI Jakarta",
        level2: "Jakarta Barat",
        level3: "Grogol Petamburan",
      },
      records,
      { providerKey: "sample" },
    );
    expect(result.record.providerId).toBe("grogol");
  });

  it("throws LOCATION_NOT_FOUND when no candidate matches", () => {
    try {
      resolveLocation(
        {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Jakarta Barat",
          level3: "Unknown District",
        },
        records,
      );
      expect.fail("expected LOCATION_NOT_FOUND");
    } catch (error) {
      expect(error).toBeInstanceOf(LocationError);
      expect((error as LocationError).code).toBe("LOCATION_NOT_FOUND");
    }
  });

  it("throws LOCATION_AMBIGUOUS when top candidates tie", () => {
    const tiedRecords = compileMappingDocumentToRecords({
      provider: "sample",
      version: "1",
      countries: [
        {
          countryCode: "ID",
          nodes: [
            {
              providerId: "west-a",
              name: "Area A",
              postalCodes: ["99999"],
            },
            {
              providerId: "west-b",
              name: "Area B",
              postalCodes: ["99999"],
            },
          ],
        },
      ],
    });

    try {
      resolveLocation(
        {
          method: "location",
          countryCode: "ID",
          postalCode: "99999",
        },
        tiedRecords,
      );
      expect.fail("expected LOCATION_AMBIGUOUS");
    } catch (error) {
      expect(error).toBeInstanceOf(LocationError);
      expect((error as LocationError).code).toBe("LOCATION_AMBIGUOUS");
    }
  });

  const aliasHierarchyDocument = {
    provider: "sample",
    version: "1",
    countries: [
      {
        countryCode: "ID",
        nodes: [
          {
            providerId: "jkt",
            name: "DKI Jakarta",
            children: [
              {
                providerId: "jakbar",
                name: "Jakarta Barat",
                aliases: ["JAKBAR", "WEST JAKARTA"],
                children: [
                  {
                    providerId: "grogol",
                    name: "Grogol Petamburan",
                    aliases: ["GROGOL"],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  it("resolves level2 canonical name", () => {
    const aliasRecords = compileMappingDocumentToRecords(aliasHierarchyDocument);
    const result = resolveLocation(
      {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Jakarta Barat",
      },
      aliasRecords,
    );
    expect(result.record.providerId).toBe("jakbar");
  });

  it("resolves level2 via alias on a non-deepest hierarchy level", () => {
    const aliasRecords = compileMappingDocumentToRecords(aliasHierarchyDocument);
    for (const level2 of ["JAKBAR", "WEST JAKARTA", "Jakbar"]) {
      const result = resolveLocation(
        {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2,
        },
        aliasRecords,
      );
      expect(result.record.providerId).toBe("jakbar");
    }
  });

  it("resolves deepest level via alias", () => {
    const aliasRecords = compileMappingDocumentToRecords(aliasHierarchyDocument);
    const result = resolveLocation(
      {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "JAKBAR",
        level3: "GROGOL",
      },
      aliasRecords,
    );
    expect(result.record.providerId).toBe("grogol");
  });

  it("throws LOCATION_NOT_FOUND when alias does not exist", () => {
    const aliasRecords = compileMappingDocumentToRecords(aliasHierarchyDocument);
    try {
      resolveLocation(
        {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "UNKNOWN DISTRICT",
        },
        aliasRecords,
      );
      expect.fail("expected LOCATION_NOT_FOUND");
    } catch (error) {
      expect(error).toBeInstanceOf(LocationError);
      expect((error as LocationError).code).toBe("LOCATION_NOT_FOUND");
    }
  });

  it("throws LOCATION_AMBIGUOUS when alias candidates tie", () => {
    const tiedAliasRecords = compileMappingDocumentToRecords({
      provider: "sample",
      version: "1",
      countries: [
        {
          countryCode: "ID",
          nodes: [
            {
              providerId: "west-a",
              name: "Area A",
              aliases: ["SHARED"],
            },
            {
              providerId: "west-b",
              name: "Area B",
              aliases: ["SHARED"],
            },
          ],
        },
      ],
    });

    try {
      resolveLocation(
        {
          method: "location",
          countryCode: "ID",
          level1: "SHARED",
        },
        tiedAliasRecords,
      );
      expect.fail("expected LOCATION_AMBIGUOUS");
    } catch (error) {
      expect(error).toBeInstanceOf(LocationError);
      expect((error as LocationError).code).toBe("LOCATION_AMBIGUOUS");
    }
  });

  it("throws LOCATION_RESOLVER_NOT_CONFIGURED for empty records", () => {
    try {
      resolveLocation(
        {
          method: "location",
          countryCode: "ID",
          postalCode: "11460",
        },
        [],
      );
      expect.fail("expected LOCATION_RESOLVER_NOT_CONFIGURED");
    } catch (error) {
      expect(error).toBeInstanceOf(LocationError);
      expect((error as LocationError).code).toBe(
        "LOCATION_RESOLVER_NOT_CONFIGURED",
      );
    }
  });
});
