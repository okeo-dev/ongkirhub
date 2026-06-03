import { ProviderError } from "@ongkirhub/core";

export type FetchFn = typeof fetch;

export interface BiteshipRateItem {
  name: string;
  description?: string;
  value?: number;
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
  quantity?: number;
}

export interface BiteshipPricing {
  company: string;
  courier_name: string;
  courier_code: string;
  courier_service_name: string;
  courier_service_code: string;
  currency: string;
  description: string;
  duration: string;
  shipment_duration_range: string;
  shipment_duration_unit: string;
  service_type: string;
  shipping_type: string;
  price: number;
  shipping_fee: number;
  shipping_fee_discount: number;
  shipping_fee_surcharge: number;
  insurance_fee: number;
  cash_on_delivery_fee: number;
}

export interface BiteshipRatesResponse {
  success: boolean;
  error?: string;
  message?: string;
  code?: number;
  pricing?: BiteshipPricing[];
}

export interface BiteshipClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchFn?: FetchFn;
  debug?: boolean;
}

export interface GetRatesParams {
  originPostalCode: string;
  destinationPostalCode: string;
  couriers: string[];
  items: BiteshipRateItem[];
}

export class BiteshipClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly debug: boolean;

  constructor(config: BiteshipClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchFn = config.fetchFn ?? fetch;
    this.debug = config.debug ?? false;
  }

  async getRates(params: GetRatesParams): Promise<BiteshipPricing[]> {
    const body = JSON.stringify({
      origin_postal_code: Number(params.originPostalCode),
      destination_postal_code: Number(params.destinationPostalCode),
      couriers: params.couriers.join(","),
      items: params.items,
    });

    if (this.debug) {
      console.log("[biteship] request", {
        url: `${this.baseUrl}/v1/rates/couriers`,
        originPostalCode: params.originPostalCode,
        destinationPostalCode: params.destinationPostalCode,
        couriers: params.couriers,
        items: params.items,
      });
    }

    const response = await this.fetchFn(
      `${this.baseUrl}/v1/rates/couriers`,
      {
        method: "POST",
        headers: {
          authorization: this.apiKey,
          "content-type": "application/json",
        },
        body,
      },
    );

    const payload = (await response.json()) as BiteshipRatesResponse;

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

    if (!payload.success || !Array.isArray(payload.pricing)) {
      throw new ProviderError(
        "UNKNOWN_PROVIDER_FAILURE",
        payload.message ??
          payload.error ??
          "Biteship response did not include pricing",
        { providerKey: "biteship" },
      );
    }

    return payload.pricing;
  }
}

function mapHttpFailure(
  status: number,
  payload: BiteshipRatesResponse,
): ProviderError {
  const message =
    payload.message ??
    payload.error ??
    `Biteship request failed with status ${status}`;

  if (status === 401 || status === 403) {
    return new ProviderError("UPSTREAM_AUTH_FAILURE", message, {
      providerKey: "biteship",
    });
  }
  if (status === 429) {
    return new ProviderError("UPSTREAM_RATE_LIMIT", message, {
      providerKey: "biteship",
    });
  }
  if (status >= 500) {
    return new ProviderError("UPSTREAM_UNAVAILABLE", message, {
      providerKey: "biteship",
    });
  }

  return new ProviderError("UNKNOWN_PROVIDER_FAILURE", message, {
    providerKey: "biteship",
  });
}
