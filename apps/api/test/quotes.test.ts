import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createProviderRegistry } from "../src/registry/providers.js";

const validOrigin = {
  method: "location",
  countryCode: "ID",
  level1: "DKI Jakarta",
  level2: "Jakarta Pusat",
};

const validDestination = {
  method: "location",
  countryCode: "ID",
  level1: "Jawa Barat",
  level2: "Bandung",
};

const rajaongkirEnv = {
  PORT: "3000",
  ENABLED_PROVIDERS: "rajaongkir",
  RAJAONGKIR_API_KEY: "test-api-key",
  RAJAONGKIR_COURIERS: "jne,pos",
};

const rajaongkirDebugEnv = {
  ...rajaongkirEnv,
  RAJAONGKIR_DEBUG: "1",
};

describe("loadEnv", () => {
  it("succeeds without RajaOngkir config when RajaOngkir is disabled", () => {
    const env = loadEnv({ PORT: "3000", ENABLED_PROVIDERS: "mock" });
    expect(env.rajaongkir).toBeUndefined();
  });

  it("fails when RajaOngkir is enabled without RAJAONGKIR_API_KEY", () => {
    expect(() =>
      loadEnv({
        ENABLED_PROVIDERS: "rajaongkir",
        RAJAONGKIR_COURIERS: "jne",
      }),
    ).toThrow(/RAJAONGKIR_API_KEY is required/);
  });

  it("fails when RajaOngkir is enabled without RAJAONGKIR_COURIERS", () => {
    expect(() =>
      loadEnv({
        ENABLED_PROVIDERS: "rajaongkir",
        RAJAONGKIR_API_KEY: "test-api-key",
      }),
    ).toThrow(/RAJAONGKIR_COURIERS is required/);
  });

  it("loads RajaOngkir config when RajaOngkir is enabled", () => {
    const env = loadEnv({
      ...rajaongkirEnv,
      RAJAONGKIR_BASE_URL: "https://example.test/api/v1",
    });
    expect(env.rajaongkir).toEqual({
      apiKey: "test-api-key",
      couriers: ["jne", "pos"],
      debug: false,
      baseUrl: "https://example.test/api/v1",
    });
  });
});

describe("provider registry", () => {
  it("throws when ENABLED_PROVIDERS contains unknown keys", () => {
    expect(() =>
      createProviderRegistry(loadEnv({ ENABLED_PROVIDERS: "mock,unknown" })),
    ).toThrow(/Unknown provider key\(s\) in ENABLED_PROVIDERS: unknown/);
  });

  it("registers valid configured providers", () => {
    const registry = createProviderRegistry(
      loadEnv({ ENABLED_PROVIDERS: "mock" }),
    );
    expect([...registry.keys()]).toEqual(["mock"]);
  });

  it("registers RajaOngkir when configured", () => {
    const env = loadEnv(rajaongkirEnv);
    const registry = createProviderRegistry(env);
    expect([...registry.keys()]).toEqual(["rajaongkir"]);
    expect(registry.get("rajaongkir")?.key).toBe("rajaongkir");
  });
});

describe("quotes API", () => {
  const env = loadEnv({ PORT: "3000", ENABLED_PROVIDERS: "mock,manual" });
  const registry = createProviderRegistry(env);
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

  it("includes RajaOngkir in health only when registered", async () => {
    const rajaEnv = loadEnv(rajaongkirEnv);
    const rajaRegistry = createProviderRegistry(rajaEnv);
    const rajaApp = createApp({
      env: rajaEnv,
      registry: rajaRegistry,
      version: "test",
    });

    const response = await rajaApp.request("/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      providers: ["rajaongkir"],
    });
    expect(JSON.stringify(body)).not.toMatch(/test-api-key/);
  });

  it("includes provider debug metadata when RajaOngkir debug is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          meta: { status: "success", code: 200 },
          data: [
            {
              name: "JNE",
              code: "jne",
              service: "REG",
              description: "JNE Regular",
              cost: 12000,
              etd: "1 day",
            },
          ],
        }),
      }),
    );

    try {
      const rajaEnv = loadEnv(rajaongkirDebugEnv);
      const rajaRegistry = createProviderRegistry(rajaEnv);
      const rajaApp = createApp({
        env: rajaEnv,
        registry: rajaRegistry,
        version: "test",
      });

      const response = await rajaApp.request("/v0/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providers: ["rajaongkir"],
          origin: {
            method: "location",
            countryCode: "ID",
            level1: "Nusa Tenggara Barat (NTB)",
            level2: "Mataram",
            level3: "Mataram",
            level4: "Mataram Timur",
          },
          destination: {
            method: "location",
            countryCode: "ID",
            level1: "Nusa Tenggara Barat (NTB)",
            level2: "Mataram",
            level3: "Ampenan",
            level4: "Ampenan Selatan",
          },
          parcels: [{ weightGrams: 1000 }],
          totalWeightGrams: 1000,
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.requestSummary).toMatchObject({
        origin: { countryCode: "ID", level1: "Nusa Tenggara Barat (NTB)", level2: "Mataram", level3: "Mataram", level4: "Mataram Timur" },
        destination: { countryCode: "ID", level1: "Nusa Tenggara Barat (NTB)", level2: "Mataram", level3: "Ampenan", level4: "Ampenan Selatan" },
      });
      expect(body.debug).toBeDefined();
      expect(body.debug.rajaongkir).toMatchObject({
        originId: expect.any(String),
        destinationId: expect.any(String),
        weightGrams: 1000,
        couriers: ["jne", "pos"],
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns normalized quotes from configured providers", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["mock"],
        origin: validOrigin,
        destination: validDestination,
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
    expect(body.requestSummary).toMatchObject({
      origin: validOrigin,
      destination: validDestination,
    });
    expect(body.debug).toBeUndefined();
  });

  it("accepts countryCode with postalCode", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["mock"],
        origin: {
          method: "location",
          countryCode: "ID",
          postalCode: "11460",
        },
        destination: {
          method: "location",
          countryCode: "ID",
          postalCode: "40111",
        },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.requestSummary).toMatchObject({
      origin: { method: "location", countryCode: "ID", postalCode: "11460" },
      destination: { method: "location", countryCode: "ID", postalCode: "40111" },
    });
  });

  it("rejects countryCode-only location input", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["mock"],
        origin: { method: "location", countryCode: "ID" },
        destination: validDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects skipped hierarchy", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["mock"],
        origin: {
          method: "location",
          countryCode: "ID",
          level2: "Jakarta Barat",
        },
        destination: validDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).toMatch(/level2 requires level1/);
  });

  it("rejects coordinate method with a clear v0.1 message", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["mock"],
        origin: {
          method: "coordinate",
          latitude: -6.1,
          longitude: 106.8,
        },
        destination: validDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).toMatch(/Coordinate input is not supported in API v0.1/);
  });

  it("rejects unknown providers", async () => {
    const response = await app.request("/v0/quotes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providers: ["unknown"],
        origin: validOrigin,
        destination: validDestination,
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      }),
    });

    expect(response.status).toBe(400);
  });
});
