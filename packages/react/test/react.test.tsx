import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createOngkirHub } from "@ongkirhub/runtime";
import { mockProvider } from "@ongkirhub/provider-mock";
import { OngkirHubProvider, useOngkirHub, useShippingQuotes } from "../src/index.js";

const hub = createOngkirHub({ providers: [mockProvider] });

function TestHubComponent() {
  const h = useOngkirHub();
  const health = h.getHealth();
  return <div data-testid="providers">{health.providers.join(",")}</div>;
}

function TestQuotesComponent() {
  const { quotes, isLoading, isSuccess } = useShippingQuotes({
    origin: { method: "location", countryCode: "ID", level1: "A", level2: "B" },
    destination: { method: "location", countryCode: "ID", level1: "C", level2: "D" },
    parcels: [{ weightGrams: 1000 }],
    totalWeightGrams: 1000,
  });

  if (isLoading) return <div data-testid="loading">Loading</div>;
  if (isSuccess) return <div data-testid="quotes">{quotes?.length ?? 0} quotes</div>;
  return <div data-testid="idle">Idle</div>;
}

describe("OngkirHubProvider", () => {
  it("provides hub to children via context", () => {
    render(
      <OngkirHubProvider hub={hub}>
        <TestHubComponent />
      </OngkirHubProvider>,
    );

    expect(screen.getByTestId("providers").textContent).toBe("mock");
  });
});

describe("useOngkirHub", () => {
  it("throws when used outside provider", () => {
    expect(() => render(<TestHubComponent />)).toThrow(
      /useOngkirHub must be used within an OngkirHubProvider/,
    );
  });
});

describe("useShippingQuotes", () => {
  it("fetches quotes through the hub", async () => {
    render(
      <OngkirHubProvider hub={hub}>
        <TestQuotesComponent />
      </OngkirHubProvider>,
    );

    expect(screen.getByTestId("loading")).toBeDefined();

    await screen.findByTestId("quotes");
    expect(screen.getByTestId("quotes").textContent).toBe("2 quotes");
  });
});
