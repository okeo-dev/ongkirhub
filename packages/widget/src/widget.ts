import { OngkirHubClient } from "@ongkirhub/client";
import { isOngkirHubError } from "@ongkirhub/client";
import { createForm, createErrorElement, createResultsElement } from "./dom.js";
import { getStyles } from "./styles.js";
import { DEFAULT_LABELS, type WidgetConfig } from "./types.js";

export class OngkirHubWidget {
  private readonly client: OngkirHubClient;
  private readonly container: HTMLElement;
  private readonly prefix: string;
  private readonly labels = DEFAULT_LABELS;
  private readonly defaultOriginPostal: string;
  private readonly defaultDestPostal: string;
  private mounted = false;
  private abortController: AbortController | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private rootEl: HTMLElement | null = null;

  constructor(config: WidgetConfig) {
    if (!config.apiUrl || !config.container) {
      throw new Error("OngkirHubWidget requires apiUrl and container");
    }

    this.client = new OngkirHubClient({ baseUrl: config.apiUrl });
    this.container =
      typeof config.container === "string"
        ? document.querySelector(config.container) ??
          (() => {
            throw new Error(`Container not found: ${config.container}`);
          })()
        : config.container;

    this.prefix = config.themePrefix ?? "ongkirhub-widget";
    this.defaultOriginPostal = config.defaultOriginPostalCode ?? "";
    this.defaultDestPostal = config.defaultDestinationPostalCode ?? "";

    if (config.labels) {
      Object.assign(this.labels, config.labels);
    }
  }

  mount(): void {
    if (this.mounted) {
      return;
    }
    this.mounted = true;

    this.styleEl = document.createElement("style");
    this.styleEl.textContent = getStyles(this.prefix);
    document.head.appendChild(this.styleEl);

    this.rootEl = document.createElement("div");
    this.rootEl.className = this.prefix;

    const form = createForm(
      this.prefix,
      this.labels,
      this.defaultOriginPostal,
      this.defaultDestPostal,
    );

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void this.handleSubmit(form);
    });

    this.rootEl.appendChild(form);
    this.container.appendChild(this.rootEl);
  }

  private async handleSubmit(form: HTMLElement): Promise<void> {
    this.clearMessages();

    const originInput = form.querySelector<HTMLInputElement>(
      `#${this.prefix}-origin`,
    );
    const destInput = form.querySelector<HTMLInputElement>(
      `#${this.prefix}-destination`,
    );
    const weightInput = form.querySelector<HTMLInputElement>(
      `#${this.prefix}-weight`,
    );

    const originPostal = originInput?.value.trim() ?? "";
    const destPostal = destInput?.value.trim() ?? "";
    const weight = Number(weightInput?.value ?? 0);

    if (!originPostal || !destPostal || !weight || weight <= 0) {
      this.showError("Please fill in all fields with valid values.");
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.textContent = this.labels.loading;
      (submitBtn as HTMLButtonElement).disabled = true;
    }

    try {
      const response = await this.client.getQuotes({
        origin: {
          method: "location",
          countryCode: "ID",
          postalCode: originPostal,
        },
        destination: {
          method: "location",
          countryCode: "ID",
          postalCode: destPostal,
        },
        parcels: [{ weightGrams: weight }],
        totalWeightGrams: weight,
      });

      if (response.quotes.length === 0) {
        this.showError(this.labels.noResults);
      } else {
        this.rootEl!.appendChild(
          createResultsElement(this.prefix, response.quotes),
        );
      }
    } catch (err) {
      if (isOngkirHubError(err)) {
        this.showError(`${this.labels.errorPrefix} ${err.message}`);
      } else if (err instanceof Error) {
        this.showError(`${this.labels.errorPrefix} ${err.message}`);
      } else {
        this.showError(`${this.labels.errorPrefix} An unexpected error occurred.`);
      }
    } finally {
      if (submitBtn) {
        submitBtn.textContent = this.labels.submit;
        (submitBtn as HTMLButtonElement).disabled = false;
      }
    }
  }

  private showError(message: string): void {
    this.rootEl!.appendChild(createErrorElement(this.prefix, message));
  }

  private clearMessages(): void {
    if (!this.rootEl) return;
    const errors = this.rootEl.querySelectorAll(`.${this.prefix}-error`);
    errors.forEach((el) => el.remove());
    const results = this.rootEl.querySelectorAll(`.${this.prefix}-results`);
    results.forEach((el) => el.remove());
  }

  destroy(): void {
    if (!this.mounted) {
      return;
    }
    this.mounted = false;

    if (this.styleEl && this.styleEl.parentNode) {
      this.styleEl.parentNode.removeChild(this.styleEl);
    }
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl);
    }
    this.styleEl = null;
    this.rootEl = null;
    this.abortController?.abort();
  }
}
