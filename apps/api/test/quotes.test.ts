import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createProviderRegistry } from "../src/registry/providers.js";

describe("provider registry", () => {
  it("throws when ENABLED_PROVIDERS contains unknown keys", () => {
    expect(() => createProviderRegistry(["mock", "unknown"])).toThrow(
      /Unknown provider key\(s\) in ENABLED_PROVIDERS: unknown/,
    );
  });

  it("registers valid configured providers", () => {
    const registry = createProviderRegistry(["mock"]);
    expect([...registry.keys()]).toEqual(["mock"]);
  });
});

describe("quotes API", () => {
  const env = loadEnv({ PORT: "3000", ENABLED_PROVIDERS: "mock,manual" });
  const registry = createProviderRegistry(env.enabledProviders);
  const app = createApp({ env, registry, version: "test" });

  it("returns health metadata", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      version: "test",
      providers: ["manual", "mock"],
    });
  });

  it("returns normalized quotes from configured providers", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["mock"],
        origin: { city: "Jakarta" },
        destination: { city: "Bandung" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.providers).toEqual(["mock"]);
    expect(body.quotes.length).toBeGreaterThan(0);
    expect(body.quotes[0]).toMatchObject({
      providerKey: "mock",
      serviceCode: expect.any(String),
      price: { amount: expect.any(Number), currency: "IDR" },
    });
  });

  it("rejects unknown providers", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["unknown"],
        origin: { city: "Jakarta" },
        destination: { city: "Bandung" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    });

    expect(response.status).toBe(400);
  });
});
