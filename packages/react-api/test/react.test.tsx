import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { useState } from "react";
import { OngkirHubProvider, useOngkirHubClient, useShippingQuotes } from "../src/index.js";
import type { OngkirHubClient } from "@ongkirhub/client";
import { OngkirHubError } from "@ongkirhub/client";

afterEach(() => {
  cleanup();
});

function createMockClient(
  overrides: Partial<OngkirHubClient> = {},
): OngkirHubClient {
  return {
    getQuotes: vi.fn().mockResolvedValue({
      quotes: [],
      providers: [],
      requestSummary: {
        origin: { method: "location", countryCode: "ID" },
        destination: { method: "location", countryCode: "ID" },
      },
    }),
    getHealth: vi.fn().mockResolvedValue({
      status: "ok",
      version: "0.1.0",
      providers: [],
    }),
    ...overrides,
  } as unknown as OngkirHubClient;
}

function ClientKey() {
  const client = useOngkirHubClient();
  return <div data-testid="client-key">{typeof client}</div>;
}

function QuoteDisplay({ request }: { request: Parameters<typeof useShippingQuotes>[0] }) {
  const result = useShippingQuotes(request);
  return (
    <div>
      <div data-testid="loading">{result.isLoading ? "loading" : "not-loading"}</div>
      <div data-testid="idle">{result.isIdle ? "idle" : "not-idle"}</div>
      <div data-testid="success">{result.isSuccess ? "success" : "not-success"}</div>
      <div data-testid="error">{result.error?.message ?? "no-error"}</div>
      <div data-testid="quotes-count">{result.quotes?.length ?? 0}</div>
      <div data-testid="providers">{result.providers?.join(",") ?? ""}</div>
      <button data-testid="refetch" onClick={result.refetch}>Refetch</button>
    </div>
  );
}

function ControlledQuoteDisplay({
  request,
  enabled,
}: {
  request: Parameters<typeof useShippingQuotes>[0];
  enabled: boolean;
}) {
  const result = useShippingQuotes(request, { enabled });
  return (
    <div>
      <div data-testid="loading">{result.isLoading ? "loading" : "not-loading"}</div>
      <div data-testid="quotes-count">{result.quotes?.length ?? 0}</div>
    </div>
  );
}

const baseRequest = {
  origin: { method: "location" as const, countryCode: "ID", postalCode: "11460" },
  destination: { method: "location" as const, countryCode: "ID", postalCode: "40111" },
  parcels: [{ weightGrams: 1000 }],
  totalWeightGrams: 1000,
};

describe("OngkirHubProvider", () => {
  it("exposes the client through context", async () => {
    const client = createMockClient();
    render(
      <OngkirHubProvider client={client}>
        <ClientKey />
      </OngkirHubProvider>,
    );
    expect(screen.getByTestId("client-key").textContent).toBe("object");
  });

  it("fails loudly when useOngkirHubClient is called outside provider", () => {
    // Suppress console.error for the expected throw
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ClientKey />)).toThrow(
      "useOngkirHubClient must be used within an OngkirHubProvider",
    );
    consoleSpy.mockRestore();
  });
});

describe("useShippingQuotes", () => {
  it("returns loading then success state", async () => {
    const client = createMockClient({
      getQuotes: vi.fn().mockResolvedValue({
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
          origin: baseRequest.origin,
          destination: baseRequest.destination,
        },
      }),
    });

    render(
      <OngkirHubProvider client={client}>
        <QuoteDisplay request={baseRequest} />
      </OngkirHubProvider>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("loading");
    expect(screen.getByTestId("idle").textContent).toBe("not-idle");

    await waitFor(() => {
      expect(screen.getByTestId("success").textContent).toBe("success");
    });

    expect(screen.getByTestId("loading").textContent).toBe("not-loading");
    expect(screen.getByTestId("quotes-count").textContent).toBe("1");
    expect(screen.getByTestId("providers").textContent).toBe("mock");
    expect(client.getQuotes).toHaveBeenCalledTimes(1);
    expect(client.getQuotes).toHaveBeenCalledWith(baseRequest);
  });

  it("surfaces client errors", async () => {
    const client = createMockClient({
      getQuotes: vi.fn().mockRejectedValue(
        new OngkirHubError("VALIDATION_ERROR", "Invalid origin", {
          status: 400,
        }),
      ),
    });

    render(
      <OngkirHubProvider client={client}>
        <QuoteDisplay request={baseRequest} />
      </OngkirHubProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("Invalid origin");
    });

    expect(screen.getByTestId("success").textContent).toBe("not-success");
    expect(screen.getByTestId("loading").textContent).toBe("not-loading");
  });

  it("does not fetch when enabled is false", async () => {
    const client = createMockClient();

    render(
      <OngkirHubProvider client={client}>
        <ControlledQuoteDisplay request={baseRequest} enabled={false} />
      </OngkirHubProvider>,
    );

    expect(screen.getByTestId("loading").textContent).toBe("not-loading");
    expect(screen.getByTestId("quotes-count").textContent).toBe("0");
    expect(client.getQuotes).not.toHaveBeenCalled();
  });

  it("refetch triggers a new request", async () => {
    const client = createMockClient({
      getQuotes: vi.fn().mockResolvedValue({
        quotes: [],
        providers: [],
        requestSummary: {
          origin: baseRequest.origin,
          destination: baseRequest.destination,
        },
      }),
    });

    render(
      <OngkirHubProvider client={client}>
        <QuoteDisplay request={baseRequest} />
      </OngkirHubProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("success").textContent).toBe("success");
    });

    expect(client.getQuotes).toHaveBeenCalledTimes(1);

    act(() => {
      screen.getByTestId("refetch").click();
    });

    await waitFor(() => {
      expect(client.getQuotes).toHaveBeenCalledTimes(2);
    });
  });

  it("refetches when request changes", async () => {
    const client = createMockClient({
      getQuotes: vi
        .fn()
        .mockResolvedValueOnce({
          quotes: [],
          providers: [],
          requestSummary: {
            origin: baseRequest.origin,
            destination: baseRequest.destination,
          },
        })
        .mockResolvedValueOnce({
          quotes: [
            {
              providerKey: "mock",
              serviceCode: "MOCK-EXP",
              serviceName: "Mock Express",
              price: { amount: 25000, currency: "IDR" },
              estimatedDuration: { value: 1, unit: "days" },
            },
          ],
          providers: ["mock"],
          requestSummary: {
            origin: { method: "location", countryCode: "ID", postalCode: "20000" },
            destination: { method: "location", countryCode: "ID", postalCode: "30000" },
          },
        }),
    });

    function Rerenderable({ request }: { request: Parameters<typeof useShippingQuotes>[0] }) {
      const result = useShippingQuotes(request);
      return (
        <div>
          <div data-testid="quotes-count">{result.quotes?.length ?? 0}</div>
          <div data-testid="loading">{result.isLoading ? "loading" : "not-loading"}</div>
        </div>
      );
    }

    const { rerender } = render(
      <OngkirHubProvider client={client}>
        <Rerenderable request={baseRequest} />
      </OngkirHubProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("not-loading");
    });

    expect(client.getQuotes).toHaveBeenCalledTimes(1);
    expect(client.getQuotes).toHaveBeenLastCalledWith(baseRequest);

    const requestB = {
      origin: { method: "location" as const, countryCode: "ID", postalCode: "20000" },
      destination: { method: "location" as const, countryCode: "ID", postalCode: "30000" },
      parcels: [{ weightGrams: 2000 }],
      totalWeightGrams: 2000,
    };

    rerender(
      <OngkirHubProvider client={client}>
        <Rerenderable request={requestB} />
      </OngkirHubProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("quotes-count").textContent).toBe("1");
    });

    expect(client.getQuotes).toHaveBeenCalledTimes(2);
    expect(client.getQuotes).toHaveBeenLastCalledWith(requestB);
  });

  it("exposes requestSummary in success state", async () => {
    const client = createMockClient({
      getQuotes: vi.fn().mockResolvedValue({
        quotes: [],
        providers: [],
        requestSummary: {
          origin: baseRequest.origin,
          destination: { method: "location", countryCode: "MY" },
        },
      }),
    });

    function SummaryDisplay({ request }: { request: Parameters<typeof useShippingQuotes>[0] }) {
      const result = useShippingQuotes(request);
      return (
        <div>
          <div data-testid="origin-cc">{result.requestSummary?.origin.countryCode}</div>
          <div data-testid="dest-cc">{result.requestSummary?.destination.countryCode}</div>
        </div>
      );
    }

    render(
      <OngkirHubProvider client={client}>
        <SummaryDisplay request={baseRequest} />
      </OngkirHubProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("origin-cc").textContent).toBe("ID");
    });

    expect(screen.getByTestId("dest-cc").textContent).toBe("MY");
  });
});
