import { describe, expect, it } from "vitest";
import { ProviderError } from "@ongkirhub/core";
import { compileYamlSourceToRecords } from "../src/location/compile.js";
import { resolveDistrict } from "../src/location/resolve.js";

function makeRecords() {
  return compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
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
                  - providerId: "100"
                    name: GROGOL
                  - providerId: "101"
                    name: JELAMBAR
              - providerId: "d2"
                name: TAMAN SARI
                children:
                  - providerId: "102"
                    name: PINANGSIA
      - providerId: "p2"
        name: JAWA BARAT
        children:
          - providerId: "c2"
            name: KOTA BANDUNG
            aliases:
              - BANDUNG
            children:
              - providerId: "d3"
                name: COBLONG
                children:
                  - providerId: "200"
                    name: CICADAS
                    postalCodes:
                      - "40132"
                  - providerId: "201"
                    name: SUKAPURA
`);
}

describe("resolveDistrict (level4 leaf)", () => {
  it("resolves canonical hierarchy to a subdistrict", () => {
    const records = makeRecords();
    const subdistrict = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
        level4: "Grogol",
      },
      records,
    );
    expect(subdistrict.providerId).toBe("100");
  });

  it("resolves via level2 alias and level4 name", () => {
    const records = makeRecords();
    const subdistrict = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Barat",
        level2: "Bandung",
        level3: "Coblong",
        level4: "Cicadas",
      },
      records,
    );
    expect(subdistrict.providerId).toBe("200");
  });

  it("resolves via postal code when unique", () => {
    const records = makeRecords();
    const subdistrict = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        postalCode: "40132",
        level1: "Jawa Barat",
        level2: "Kota Bandung",
      },
      records,
    );
    expect(subdistrict.providerId).toBe("200");
  });

  it("resolves via unique postal code without hierarchy hints", () => {
    const records = makeRecords();
    const subdistrict = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        postalCode: "40132",
      },
      records,
    );
    expect(subdistrict.providerId).toBe("200");
  });

  it("throws LOCATION_NOT_FOUND when postal code contradicts hierarchy", () => {
    const records = makeRecords();
    expect(() =>
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          postalCode: "40132",
          level1: "Jawa Barat",
          level2: "Kota Bandung",
          level3: "Coblong",
          level4: "Sukapura",
        },
        records,
      ),
    ).toThrow(ProviderError);

    try {
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          postalCode: "40132",
          level1: "Jawa Barat",
          level2: "Kota Bandung",
          level3: "Coblong",
          level4: "Sukapura",
        },
        records,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    }
  });

  it("throws LOCATION_NOT_FOUND when subdistrict cannot be resolved", () => {
    const records = makeRecords();
    expect(() =>
      resolveDistrict(
        {
          method: "location",
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Kota Jakarta Barat",
          level3: "Grogol Petamburan",
          level4: "Unknown Subdistrict",
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
          level3: "Grogol Petamburan",
          level4: "Unknown Subdistrict",
        },
        records,
      );
    } catch (error) {
      expect(error).toMatchObject({ code: "LOCATION_NOT_FOUND" });
    }
  });

  it("throws LOCATION_AMBIGUOUS when postal code ties subdistricts", () => {
    const records = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
        name: PROV
        children:
          - providerId: "c1"
            name: CITY
            children:
              - providerId: "d1"
                name: DISTRICT A
                children:
                  - providerId: "10"
                    name: SUB A
                    postalCodes: ["99999"]
                  - providerId: "11"
                    name: SUB B
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
        records,
      ),
    ).toThrow(expect.objectContaining({ code: "LOCATION_AMBIGUOUS" }));
  });

  it("with unsafeAllowAmbiguousBestMatch enabled, returns first match instead of throwing", () => {
    const records = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
        name: PROV
        children:
          - providerId: "c1"
            name: CITY
            children:
              - providerId: "d1"
                name: DISTRICT A
                children:
                  - providerId: "10"
                    name: SUB A
                    postalCodes: ["99999"]
                  - providerId: "11"
                    name: SUB B
                    postalCodes: ["99999"]
`);

    const result = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        postalCode: "99999",
        level1: "PROV",
        level2: "CITY",
      },
      records,
      true,
    );
    expect(result.providerId).toBe("10");
  });

  it("accepts confident level 3 district match for domestic", () => {
    const records = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
        name: JAWA TIMUR
        children:
          - providerId: "c1"
            name: SURABAYA
            children:
              - providerId: "d1"
                name: GUBENG
                children:
                  - providerId: "100"
                    name: GUBENG
`);

    // Input provides level1–level3 only. The district (level 3) is the best match.
    // Domestic resolution should accept it directly instead of rejecting or falling back.
    const result = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        level1: "Jawa Timur",
        level2: "Surabaya",
        level3: "Gubeng",
      },
      records,
    );
    expect(result.providerId).toBe("d1");
    expect(result.level).toBe(3);
  });

  it("with flag enabled but no ambiguity, still resolves normally", () => {
    const records = makeRecords();
    const subdistrict = resolveDistrict(
      {
        method: "location",
        countryCode: "ID",
        level1: "DKI Jakarta",
        level2: "Kota Jakarta Barat",
        level3: "Grogol Petamburan",
        level4: "Grogol",
      },
      records,
      true,
    );
    expect(subdistrict.providerId).toBe("100");
  });
});
