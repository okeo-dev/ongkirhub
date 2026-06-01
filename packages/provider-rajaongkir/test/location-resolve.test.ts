import { describe, expect, it } from "vitest";
import { ProviderError } from "@ongkirhub/core";
import { compileYamlSourceToRecords } from "../src/location/compile.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDistrict } from "../src/location/resolve.js";

const yamlSource = readFileSync(
  join(import.meta.dirname, "../src/location/source/locations.yaml"),
  "utf8",
);
const records = compileYamlSourceToRecords(yamlSource);

describe("resolveDistrict", () => {
  it("resolves canonical hierarchy to a district", () => {
    const district = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
      },
      records,
    );
    expect(district.providerId).toBe("2088");
  });

  it("resolves via level2 alias and level3 alias", () => {
    const district = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Barat",
        level2: "Bandung",
        level3: "Cicadas",
      },
      records,
    );
    expect(district.providerId).toBe("339");
  });

  it("resolves via postal code when unique", () => {
    const syntheticRecords = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
        name: PROV
        children:
          - providerId: "c1"
            name: KOTA CITY
            aliases:
              - CITY
            children:
              - providerId: "100"
                name: DISTRICT A
                postalCodes:
                  - "12345"
              - providerId: "101"
                name: DISTRICT B
`);

    const district = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        postalCode: "12345",
        level1: "PROV",
        level2: "KOTA CITY",
      },
      syntheticRecords,
    );
    expect(district.providerId).toBe("100");
  });

  it("resolves via unique postal code without hierarchy hints", () => {
    const syntheticRecords = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
        name: PROV
        children:
          - providerId: "c1"
            name: KOTA CITY
            aliases:
              - CITY
            children:
              - providerId: "100"
                name: DISTRICT A
                postalCodes:
                  - "12345"
              - providerId: "101"
                name: DISTRICT B
`);

    const district = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        postalCode: "12345",
      },
      syntheticRecords,
    );
    expect(district.providerId).toBe("100");
  });

  it("throws LOCATION_NOT_FOUND when postal code contradicts hierarchy", () => {
    const syntheticRecords = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
        name: PROV
        children:
          - providerId: "c1"
            name: KOTA CITY
            aliases:
              - CITY
            children:
              - providerId: "100"
                name: DISTRICT A
                postalCodes:
                  - "12345"
              - providerId: "101"
                name: DISTRICT B
`);

    expect(() =>
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          postalCode: "12345",
          level1: "PROV",
          level2: "KOTA CITY",
          level3: "DISTRICT B",
        },
        syntheticRecords,
      ),
    ).toThrow(ProviderError);

    try {
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          postalCode: "12345",
          level1: "PROV",
          level2: "KOTA CITY",
          level3: "DISTRICT B",
        },
        syntheticRecords,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    }
  });

  it("throws LOCATION_NOT_FOUND when district cannot be resolved", () => {
    expect(() =>
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Kota Jakarta Barat",
          level3: "Unknown District",
        },
        records,
      ),
    ).toThrow(ProviderError);

    try {
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Kota Jakarta Barat",
          level3: "Unknown District",
        },
        records,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    }
  });

  it("throws LOCATION_AMBIGUOUS when postal code ties districts", () => {
    const ambiguousRecords = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "1"
        name: PROV
        children:
          - providerId: "2"
            name: CITY
            children:
              - providerId: "10"
                name: DISTRICT A
                postalCodes: ["99999"]
              - providerId: "11"
                name: DISTRICT B
                postalCodes: ["99999"]
`);

    expect(() =>
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          postalCode: "99999",
          level1: "PROV",
          level2: "CITY",
        },
        ambiguousRecords,
      ),
    ).toThrow(
      expect.objectContaining({ code: "LOCATION_AMBIGUOUS" }),
    );
  });
});
