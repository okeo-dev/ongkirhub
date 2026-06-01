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
  it("compiles YAML into runtime records with normalized aliases", () => {
    const yamlSource = readFileSync(sourcePath, "utf8");
    const records = compileYamlSourceToRecords(yamlSource);

    expect(records.length).toBeGreaterThan(0);

    const jakarta = records.find((record) => record.providerId === "p6");
    expect(jakarta?.level).toBe(1);
    expect(jakarta?.normalizedAliases).toEqual([
      "DAERAH KHUSUS IBUKOTA JAKARTA",
    ]);

    const bandung = records.find((record) => record.providerId === "c23");
    expect(bandung?.level).toBe(2);
    expect(bandung?.name).toBe("KOTA BANDUNG");
    expect(bandung?.normalizedAliases).toEqual(["BANDUNG"]);

    const antapani = records.find((record) => record.providerId === "339");
    expect(antapani?.level).toBe(3);
    expect(antapani?.name).toBe("ANTAPANI");
    expect(antapani?.normalizedAliases).toEqual(["CICADAS"]);
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
