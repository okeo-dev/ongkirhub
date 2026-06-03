import { ProviderError } from "@ongkirhub/core";

export type FetchFn = typeof fetch;

export interface RajaOngkirCostItem {
  name: string;
  code: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export interface RajaOngkirInternationalCostItem {
  name: string;
  code: string;
  service: string;
  description: string;
  currency: string;
  cost: number;
  etd: string;
}

interface RajaOngkirCostResponse {
  meta?: {
    message?: string;
    code?: number;
    status?: string;
  };
  data?: RajaOngkirCostItem[];
}

interface RajaOngkirInternationalCostResponse {
  meta?: {
    message?: string;
    code?: number;
    status?: string;
  };
  data?: RajaOngkirInternationalCostItem[];
}

export interface RajaOngkirClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchFn?: FetchFn;
  debug?: boolean;
}

export interface CalculateDomesticCostParams {
  originId: string;
  destinationId: string;
  weightGrams: number;
  couriers: string[];
  priceSort?: "lowest" | "highest";
}

export interface CalculateInternationalCostParams {
  originId: string;
  destinationCountryId: string;
  weightGrams: number;
  couriers: string[];
  priceSort?: "lowest" | "highest";
}

export class RajaOngkirClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly debug: boolean;

  constructor(config: RajaOngkirClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchFn = config.fetchFn ?? fetch;
    this.debug = config.debug ?? false;
  }

  async calculateDomesticCost(
    params: CalculateDomesticCostParams,
  ): Promise<RajaOngkirCostItem[]> {
    const body = new URLSearchParams({
      origin: params.originId,
      destination: params.destinationId,
      weight: String(params.weightGrams),
      courier: params.couriers.join(":"),
      price: params.priceSort ?? "lowest",
    });

    if (this.debug) {
      console.log("[rajaongkir] request", {
        url: `${this.baseUrl}/calculate/domestic-cost`,
        origin: params.originId,
        destination: params.destinationId,
        weight: params.weightGrams,
        couriers: params.couriers,
        priceSort: params.priceSort ?? "lowest",
      });
    }

    const response = await this.fetchFn(
      `${this.baseUrl}/calculate/domestic-cost`,
      {
        method: "POST",
        headers: {
          key: this.apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    const payload = (await response.json()) as RajaOngkirCostResponse;

    if (this.debug) {
      console.dir(
        {
          status: response.status,
          ok: response.ok,
          payload,
        },
        { depth: null },
      );
    }

    if (!response.ok) {
      throw mapHttpFailure(response.status, payload);
    }

    if (!Array.isArray(payload.data)) {
      throw new ProviderError(
        "UNKNOWN_PROVIDER_FAILURE",
        "RajaOngkir response did not include shipping options",
        { providerKey: "rajaongkir" },
      );
    }

    return payload.data;
  }

  async calculateInternationalCost(
    params: CalculateInternationalCostParams,
  ): Promise<RajaOngkirInternationalCostItem[]> {
    const body = new URLSearchParams({
      origin: params.originId,
      destination: params.destinationCountryId,
      weight: String(params.weightGrams),
      courier: params.couriers.join(":"),
      price: params.priceSort ?? "lowest",
    });

    if (this.debug) {
      console.log("[rajaongkir] international request", {
        url: `${this.baseUrl}/calculate/international-cost`,
        origin: params.originId,
        destination: params.destinationCountryId,
        weight: params.weightGrams,
        couriers: params.couriers,
        priceSort: params.priceSort ?? "lowest",
      });
    }

    const response = await this.fetchFn(
      `${this.baseUrl}/calculate/international-cost`,
      {
        method: "POST",
        headers: {
          key: this.apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    const payload = (await response.json()) as RajaOngkirInternationalCostResponse;

    if (this.debug) {
      console.dir(
        {
          status: response.status,
          ok: response.ok,
          payload,
        },
        { depth: null },
      );
    }

    if (!response.ok) {
      throw mapHttpFailure(response.status, payload);
    }

    if (!Array.isArray(payload.data)) {
      throw new ProviderError(
        "UNKNOWN_PROVIDER_FAILURE",
        "RajaOngkir international response did not include shipping options",
        { providerKey: "rajaongkir" },
      );
    }

    return payload.data;
  }
}

function mapHttpFailure(
  status: number,
  payload: RajaOngkirCostResponse,
): ProviderError {
  const message =
    payload.meta?.message ??
    `RajaOngkir request failed with status ${status}`;

  if (status === 401 || status === 403) {
    return new ProviderError("UPSTREAM_AUTH_FAILURE", message, {
      providerKey: "rajaongkir",
    });
  }
  if (status === 429) {
    return new ProviderError("UPSTREAM_RATE_LIMIT", message, {
      providerKey: "rajaongkir",
    });
  }
  if (status >= 500) {
    return new ProviderError("UPSTREAM_UNAVAILABLE", message, {
      providerKey: "rajaongkir",
    });
  }

  return new ProviderError("UNKNOWN_PROVIDER_FAILURE", message, {
    providerKey: "rajaongkir",
  });
}
