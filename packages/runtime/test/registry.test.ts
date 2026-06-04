import { describe, expect, it } from "vitest";
import { listProviderKeys, resolveProviders } from "../src/registry.js";

function makeProvider(key: string) {
  return {
    key,
    name: key,
    capabilities: {
      coverage: ["domestic"] as const,
      dimensionsRequired: false,
      codSupported: false,
      serviceFilteringSupported: false,
    },
    async getQuotes() {
      return [];
    },
  };
}

describe("listProviderKeys", () => {
  it("returns sorted keys", () => {
    const registry = new Map([
      ["b", makeProvider("b")],
      ["a", makeProvider("a")],
      ["c", makeProvider("c")],
    ]);
    expect(listProviderKeys(registry)).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty registry", () => {
    expect(listProviderKeys(new Map())).toEqual([]);
  });
});

describe("resolveProviders", () => {
  it("returns all providers when no filter given", () => {
    const registry = new Map([
      ["mock", makeProvider("mock")],
      ["manual", makeProvider("manual")],
    ]);
    const result = resolveProviders(registry);
    expect(result.map((p) => p.key)).toEqual(["mock", "manual"]);
  });

  it("resolves a single requested provider", () => {
    const registry = new Map([
      ["mock", makeProvider("mock")],
      ["manual", makeProvider("manual")],
    ]);
    const result = resolveProviders(registry, "mock");
    expect(result.map((p) => p.key)).toEqual(["mock"]);
  });

  it("resolves multiple requested providers", () => {
    const registry = new Map([
      ["mock", makeProvider("mock")],
      ["manual", makeProvider("manual")],
    ]);
    const result = resolveProviders(registry, ["manual", "mock"]);
    expect(result.map((p) => p.key)).toEqual(["manual", "mock"]);
  });

  it("throws for unknown provider key", () => {
    const registry = new Map([["mock", makeProvider("mock")]]);
    expect(() => resolveProviders(registry, "unknown")).toThrow(/Unknown provider: unknown/);
  });
});
