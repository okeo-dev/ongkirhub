import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compileYamlSourceToRecords,
  LocationCompileError,
  parseMappingDocument,
} from "../src/location/compile.js";

const sourcePath = join(
  import.meta.dirname,
  "../src/location/source/locations.yaml",
);

describe("location compile", () => {
  it("compiles real YAML into runtime records", () => {
    const yamlSource = readFileSync(sourcePath, "utf8");
    const records = compileYamlSourceToRecords(yamlSource);
    expect(records.length).toBeGreaterThan(0);
  });

  it("compiles level4 hierarchy with normalized aliases and postal codes", () => {
    const records = compileYamlSourceToRecords(`
provider: rajaongkir
version: "1"
countries:
  - countryCode: ID
    nodes:
      - providerId: "p1"
        name: PROV
        aliases:
          - ALIAS PROV
        children:
          - providerId: "c1"
            name: KOTA CITY
            aliases:
              - CITY
            children:
              - providerId: "d1"
                name: DISTRICT
                children:
                  - providerId: "100"
                    name: SUBDISTRICT
                    postalCodes:
                      - "12345"
`);

    expect(records.length).toBe(4);

    const prov = records.find((r) => r.providerId === "p1");
    expect(prov?.level).toBe(1);
    expect(prov?.normalizedAliases).toEqual(["ALIAS PROV"]);

    const city = records.find((r) => r.providerId === "c1");
    expect(city?.level).toBe(2);
    expect(city?.name).toBe("KOTA CITY");
    expect(city?.normalizedAliases).toEqual(["CITY"]);

    const district = records.find((r) => r.providerId === "d1");
    expect(district?.level).toBe(3);
    expect(district?.name).toBe("DISTRICT");

    const sub = records.find((r) => r.providerId === "100");
    expect(sub?.level).toBe(4);
    expect(sub?.name).toBe("SUBDISTRICT");
    expect(sub?.postalCodes).toEqual(["12345"]);
  });

  it("fails on duplicate providerId", () => {
    expect(() =>
      parseMappingDocument({
        provider: "rajaongkir",
        version: "1",
        countries: [
          {
            countryCode: "ID",
            nodes: [
              { providerId: "dup", name: "Area A" },
              { providerId: "dup", name: "Area B" },
            ],
          },
        ],
      }),
    ).toThrow(LocationCompileError);
  });

  it("fails on missing providerId", () => {
    expect(() =>
      parseMappingDocument({
        provider: "rajaongkir",
        version: "1",
        countries: [
          {
            countryCode: "ID",
            nodes: [{ name: "No Id" }],
          },
        ],
      }),
    ).toThrow(/providerId is required/);
  });

  it("fails on empty countries", () => {
    expect(() =>
      parseMappingDocument({
        provider: "rajaongkir",
        version: "1",
        countries: [],
      }),
    ).toThrow(/countries must be a non-empty array/);
  });
});
