import { describe, expect, it, vi } from "vitest";
import { OngkirHubClient } from "../src/client.js";
import { OngkirHubError, isOngkirHubError } from "../src/errors.js";
import type { DestinationSummary, OriginSummary } from "../src/types.js";

// Type-level proof: DestinationSummary accepts countryCode-only international responses
const _countryOnlyDestination: DestinationSummary = {
  method: "location",
  countryCode: "MY",
};

// Type-level proof: OriginSummary retains full LocationMethodInput shape
const _strictOrigin: OriginSummary = {
  method: "location",
  countryCode: "ID",
  postalCode: "11460",
};

// Prevent unused-variable lint errors in a way that keeps the types compile-time only
void _countryOnlyDestination;
void _strictOrigin;

const createMockFetch = (responses: Array<() => Response>) => {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[callIndex];
    callIndex += 1;
    if (!response) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Unexpected extra call" }), {
          status: 500,
        }),
      );
    }
    return Promise.resolve(response());
  });
};

const baseConfig = {
  baseUrl: "https://api.example.com",
};

describe("OngkirHubClient", () => {
  describe("getHealth", () => {
    it("returns health metadata on success", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(
            JSON.stringify({
              status: "ok",
              version: "0.1.0",
              providers: ["mock", "manual"],
            }),
            { status: 200 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      const health = await client.getHealth();

      expect(health).toEqual({
        status: "ok",
        version: "0.1.0",
        providers: ["mock", "manual"],
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/health",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("retries on 5xx and succeeds", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(JSON.stringify({ error: "Bad Gateway" }), {
            status: 502,
          }),
        () =>
          new Response(
            JSON.stringify({
              status: "ok",
              version: "0.1.0",
              providers: ["mock"],
            }),
            { status: 200 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      const health = await client.getHealth();

      expect(health.status).toBe("ok");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 4xx", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
          }),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      await expect(client.getHealth()).rejects.toMatchObject({
        code: "UNKNOWN_ERROR",
        context: { status: 404 },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getQuotes", () => {
    it("sends correct JSON body and returns quotes", async () => {
      const request = {
        origin: {
          method: "location" as const,
          countryCode: "ID",
          level1: "DKI Jakarta",
          level2: "Jakarta Pusat",
        },
        destination: {
          method: "location" as const,
          countryCode: "ID",
          level1: "Jawa Barat",
          level2: "Bandung",
        },
        parcels: [{ weightGrams: 1500 }],
        totalWeightGrams: 1500,
      };

      const fetchMock = createMockFetch([
        () =>
          new Response(
            JSON.stringify({
              quotes: [
                {
                  providerKey: "mock",
                  serviceCode: "MOCK-STD",
                  serviceName: "Mock Standard",
                  price: { amount: 12000, currency: "IDR" },
                  estimatedDuration: { value: 2, unit: "days" },
                },
              ],
              providers: ["mock"],
              requestSummary: {
                origin: request.origin,
                destination: request.destination,
              },
            }),
            { status: 200 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      const response = await client.getQuotes(request);

      expect(response.quotes).toHaveLength(1);
      expect(response.quotes[0]?.price.amount).toBe(12000);
      expect(response.requestSummary.origin.countryCode).toBe("ID");

      const [, init] = fetchMock.mock.calls[0]!;
      const body = JSON.parse(init?.body as string);
      expect(body).toEqual(request);
      expect(init?.headers).toMatchObject({
        "content-type": "application/json",
        accept: "application/json",
      });
    });

    it("accepts countryCode-only destination in response summary", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(
            JSON.stringify({
              quotes: [
                {
                  providerKey: "rajaongkir",
                  serviceCode: "JNE-OKE",
                  serviceName: "JNE OKE",
                  price: { amount: 250000, currency: "IDR" },
                  estimatedDuration: { value: 5, unit: "days" },
                },
              ],
              providers: ["rajaongkir"],
              requestSummary: {
                origin: {
                  method: "location",
                  countryCode: "ID",
                  postalCode: "11460",
                },
                destination: {
                  method: "location",
                  countryCode: "MY",
                },
              },
            }),
            { status: 200 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      const response = await client.getQuotes({
        origin: { method: "location", countryCode: "ID", postalCode: "11460" },
        destination: { method: "location", countryCode: "MY" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      });

      expect(response.requestSummary.destination).toEqual({
        method: "location",
        countryCode: "MY",
      });
      expect(response.requestSummary.origin).toEqual({
        method: "location",
        countryCode: "ID",
        postalCode: "11460",
      });
    });

    it("maps 4xx validation errors to typed client errors without retry", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(
            JSON.stringify({
              error: "Validation failed",
              details: { fieldErrors: { origin: ["countryCode is required"] } },
            }),
            { status: 400 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      await expect(
        client.getQuotes({
          origin: { method: "location", countryCode: "ID" },
          destination: { method: "location", countryCode: "ID" },
          parcels: [{ weightGrams: 1000 }],
          totalWeightGrams: 1000,
        }),
      ).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        context: { status: 400 },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("maps 502 provider errors with providerKey context", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(
            JSON.stringify({
              error: "Upstream unavailable",
              code: "UPSTREAM_UNAVAILABLE",
              providerKey: "rajaongkir",
            }),
            { status: 502 },
          ),
        () =>
          new Response(
            JSON.stringify({
              error: "Upstream unavailable",
              code: "UPSTREAM_UNAVAILABLE",
              providerKey: "rajaongkir",
            }),
            { status: 502 },
          ),
        () =>
          new Response(
            JSON.stringify({
              error: "Upstream unavailable",
              code: "UPSTREAM_UNAVAILABLE",
              providerKey: "rajaongkir",
            }),
            { status: 502 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      await expect(
        client.getQuotes({
          origin: { method: "location", countryCode: "ID" },
          destination: { method: "location", countryCode: "ID" },
          parcels: [{ weightGrams: 1000 }],
          totalWeightGrams: 1000,
        }),
      ).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
        message: "Upstream unavailable",
        context: { status: 502, providerKey: "rajaongkir" },
      });
    });

    it("retries getQuotes on 5xx then succeeds", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(JSON.stringify({ error: "Server Error" }), {
            status: 500,
          }),
        () =>
          new Response(
            JSON.stringify({
              quotes: [],
              providers: [],
              requestSummary: {
                origin: { method: "location", countryCode: "ID" },
                destination: { method: "location", countryCode: "ID" },
              },
            }),
            { status: 200 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      const response = await client.getQuotes({
        origin: { method: "location", countryCode: "ID" },
        destination: { method: "location", countryCode: "ID" },
        parcels: [{ weightGrams: 1000 }],
        totalWeightGrams: 1000,
      });

      expect(response.quotes).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry getQuotes on 4xx", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(JSON.stringify({ error: "Bad Request" }), {
            status: 400,
          }),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      await expect(
        client.getQuotes({
          origin: { method: "location", countryCode: "ID" },
          destination: { method: "location", countryCode: "ID" },
          parcels: [{ weightGrams: 1000 }],
          totalWeightGrams: 1000,
        }),
      ).rejects.toBeDefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("fails loudly on invalid JSON response", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("not-json", { status: 200 }),
      );

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      await expect(
        client.getHealth(),
      ).rejects.toMatchObject({
        code: "PARSE_ERROR",
        message: /not valid JSON/,
      });
    });

    it("maps network failure to NETWORK_ERROR", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      await expect(client.getHealth()).rejects.toMatchObject({
        code: "NETWORK_ERROR",
        message: /fetch failed/,
      });
    });

    it("uses injected fetchFn instead of global fetch", async () => {
      const fetchMock = createMockFetch([
        () =>
          new Response(
            JSON.stringify({
              status: "ok",
              version: "test",
              providers: [],
            }),
            { status: 200 },
          ),
      ]);

      const client = new OngkirHubClient({ ...baseConfig, fetchFn: fetchMock });
      await client.getHealth();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("isOngkirHubError", () => {
    it("returns true for OngkirHubError instances", () => {
      expect(isOngkirHubError(new OngkirHubError("UNKNOWN_ERROR", "test"))).toBe(true);
    });

    it("returns false for plain errors", () => {
      expect(isOngkirHubError(new Error("test"))).toBe(false);
    });
  });

  describe("timeout behavior", () => {
    it("throws TIMEOUT_ERROR when request exceeds timeout", async () => {
      const slowFetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          const onAbort = () => {
            const err = new Error("The operation was aborted") as Error & { name: string };
            err.name = "AbortError";
            reject(err);
          };
          if (init?.signal) {
            if (init.signal.aborted) {
              onAbort();
              return;
            }
            init.signal.addEventListener("abort", onAbort);
          }
        });
      });

      const client = new OngkirHubClient({
        ...baseConfig,
        fetchFn: slowFetch,
        timeoutMs: 50,
      });

      await expect(client.getHealth()).rejects.toMatchObject({
        code: "TIMEOUT_ERROR",
        message: /timed out after 50ms/,
      });
    }, 15000);
  });
});
