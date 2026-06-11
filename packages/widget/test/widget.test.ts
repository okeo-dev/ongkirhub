import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { OngkirHubWidget } from "../src/widget.js";

// Mock @ongkirhub/client so tests do not depend on real fetch
vi.mock("@ongkirhub/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@ongkirhub/client")>();
  return {
    ...mod,
    OngkirHubClient: vi.fn().mockImplementation(() => ({
      getQuotes: vi.fn(),
      getHealth: vi.fn(),
    })),
  };
});

function setupContainer(): HTMLElement {
  const el = document.createElement("div");
  el.id = "widget-test-container";
  document.body.appendChild(el);
  return el;
}

describe("OngkirHubWidget", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = setupContainer();
  });

  afterEach(() => {
    container.remove();
    // Clean up any stray styles
    document.querySelectorAll("style").forEach((s) => {
      if (s.textContent?.includes("ongkirhub-widget")) s.remove();
    });
  });

  it("validates required config", () => {
    expect(() => new OngkirHubWidget({ apiUrl: "", container: "#missing" })).toThrow(
      "requires apiUrl and container",
    );
  });

  it("mounts into the target container", () => {
    const widget = new OngkirHubWidget({
      apiUrl: "https://api.example.com",
      container: "#widget-test-container",
    });
    widget.mount();

    expect(container.querySelector(".ongkirhub-widget")).not.toBeNull();
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector("input")).not.toBeNull();
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("mounts into a raw HTMLElement container", () => {
    const rawContainer = document.createElement("div");
    document.body.appendChild(rawContainer);

    const widget = new OngkirHubWidget({
      apiUrl: "https://api.example.com",
      container: rawContainer,
    });
    widget.mount();

    expect(rawContainer.querySelector(".ongkirhub-widget")).not.toBeNull();
    rawContainer.remove();
  });

  it("uses OngkirHubClient internally", async () => {
    const { OngkirHubClient } = await import("@ongkirhub/client");
    const widget = new OngkirHubWidget({
      apiUrl: "https://api.example.com",
      container: "#widget-test-container",
    });
    widget.mount();
    expect(OngkirHubClient).toHaveBeenCalledWith({ baseUrl: "https://api.example.com" });
  });

  it("submits form and renders quotes on success", async () => {
    const { OngkirHubClient } = await import("@ongkirhub/client");
    const getQuotes = vi.fn().mockResolvedValue({
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
        origin: { method: "location", countryCode: "ID", postalCode: "11460" },
        destination: { method: "location", countryCode: "ID", postalCode: "40111" },
      },
    });
    (OngkirHubClient as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getQuotes,
      getHealth: vi.fn(),
    }));

    const widget = new OngkirHubWidget({
      apiUrl: "https://api.example.com",
      container: "#widget-test-container",
    });
    widget.mount();

    const form = container.querySelector("form") as HTMLFormElement;
    const originInput = container.querySelector<HTMLInputElement>("#ongkirhub-widget-origin")!;
    const destInput = container.querySelector<HTMLInputElement>("#ongkirhub-widget-destination")!;
    const weightInput = container.querySelector<HTMLInputElement>("#ongkirhub-widget-weight")!;

    originInput.value = "11460";
    destInput.value = "40111";
    weightInput.value = "1500";

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    // Wait for async fetch
    await new Promise((r) => setTimeout(r, 10));

    expect(getQuotes).toHaveBeenCalledTimes(1);
    expect(getQuotes).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: expect.objectContaining({ postalCode: "11460" }),
        destination: expect.objectContaining({ postalCode: "40111" }),
        totalWeightGrams: 1500,
      }),
    );

    const results = container.querySelector(".ongkirhub-widget-results");
    expect(results).not.toBeNull();
    expect(results!.textContent).toContain("Mock Standard");
    expect(results!.textContent).toContain("12,000 IDR");
  });

  it("renders client errors in user-facing form", async () => {
    const { OngkirHubClient, OngkirHubError } = await import("@ongkirhub/client");
    const getQuotes = vi.fn().mockRejectedValue(
      new OngkirHubError("VALIDATION_ERROR", "Invalid postal code", { status: 400 }),
    );
    (OngkirHubClient as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getQuotes,
      getHealth: vi.fn(),
    }));

    const widget = new OngkirHubWidget({
      apiUrl: "https://api.example.com",
      container: "#widget-test-container",
    });
    widget.mount();

    const form = container.querySelector("form") as HTMLFormElement;
    const originInput = container.querySelector<HTMLInputElement>("#ongkirhub-widget-origin")!;
    const destInput = container.querySelector<HTMLInputElement>("#ongkirhub-widget-destination")!;
    const weightInput = container.querySelector<HTMLInputElement>("#ongkirhub-widget-weight")!;

    originInput.value = "00000";
    destInput.value = "00000";
    weightInput.value = "1000";

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));

    const errorEl = container.querySelector(".ongkirhub-widget-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain("Invalid postal code");
    expect(errorEl!.textContent).not.toContain("VALIDATION_ERROR");
    expect(errorEl!.textContent).not.toContain("stack");
  });

  it("shows validation error for empty fields without calling client", async () => {
    const { OngkirHubClient } = await import("@ongkirhub/client");
    const getQuotes = vi.fn();
    (OngkirHubClient as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      getQuotes,
      getHealth: vi.fn(),
    }));

    const widget = new OngkirHubWidget({
      apiUrl: "https://api.example.com",
      container: "#widget-test-container",
    });
    widget.mount();

    const form = container.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));

    expect(getQuotes).not.toHaveBeenCalled();
    const errorEl = container.querySelector(".ongkirhub-widget-error");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain("Please fill in all fields");
  });

  it("destroy removes DOM and styles", () => {
    const widget = new OngkirHubWidget({
      apiUrl: "https://api.example.com",
      container: "#widget-test-container",
    });
    widget.mount();

    expect(container.querySelector(".ongkirhub-widget")).not.toBeNull();
    expect(document.querySelector("style")).not.toBeNull();

    widget.destroy();

    expect(container.querySelector(".ongkirhub-widget")).toBeNull();
    expect(document.querySelector("style")).toBeNull();
  });
});
