import { ProviderError, type ProviderErrorCode } from "@ongkirhub/core";

export type FetchFn = typeof fetch;

export interface EasyPostAddress {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface EasyPostParcel {
  length?: number;
  width?: number;
  height?: number;
  weight: number;
}

export interface EasyPostRate {
  id: string;
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  list_rate?: string;
  list_currency?: string;
  retail_rate?: string;
  retail_currency?: string;
  delivery_days?: number;
  delivery_date?: string;
  delivery_date_guaranteed?: boolean;
  est_delivery_days?: number;
  billing_type?: string;
  carrier_account_id: string;
  shipment_id: string;
}

export interface EasyPostShipment {
  id: string;
  rates: EasyPostRate[];
}

export interface EasyPostErrorPayload {
  error?: {
    code?: string;
    message?: string;
    errors?: Array<{ code?: string; field?: string; message?: string }>;
  };
}

export interface EasyPostClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchFn?: FetchFn;
  debug?: boolean;
}

export interface CreateShipmentParams {
  fromAddress: EasyPostAddress;
  toAddress: EasyPostAddress;
  parcel: EasyPostParcel;
}

function encodeBasicAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export class EasyPostClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly debug: boolean;

  constructor(config: EasyPostClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchFn =
      config.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.debug = config.debug ?? false;
  }

  async createShipment(params: CreateShipmentParams): Promise<EasyPostShipment> {
    const body = JSON.stringify({
      shipment: {
        from_address: params.fromAddress,
        to_address: params.toAddress,
        parcel: params.parcel,
      },
    });

    if (this.debug) {
      console.log("[easypost] request", {
        url: `${this.baseUrl}/shipments`,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        parcel: params.parcel,
      });
    }

    const response = await this.fetchFn(`${this.baseUrl}/shipments`, {
      method: "POST",
      headers: {
        authorization: encodeBasicAuth(this.apiKey),
        "content-type": "application/json",
      },
      body,
    });

    const payload = (await response.json()) as EasyPostShipment | EasyPostErrorPayload;

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
      throw mapHttpFailure(response.status, payload as EasyPostErrorPayload);
    }

    if (!isShipment(payload)) {
      throw new ProviderError(
        "UNKNOWN_PROVIDER_FAILURE",
        "EasyPost response did not include shipment rates",
        { providerKey: "easypost" },
      );
    }

    return payload;
  }
}

function isShipment(payload: unknown): payload is EasyPostShipment {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    "rates" in payload &&
    Array.isArray((payload as Record<string, unknown>).rates)
  );
}

function classify4xxError(payload: EasyPostErrorPayload): ProviderErrorCode {
  const rootCode = payload.error?.code ?? "";
  const nestedCodes = payload.error?.errors?.map((e) => e.code ?? "") ?? [];
  const allCodes = new Set([rootCode, ...nestedCodes].map((c) => c.toUpperCase()));

  const addressCodes = new Set([
    "ADDRESS.VERIFY.FAILURE",
    "E.ADDRESS.NOT_FOUND",
    "ADDRESS.INSUFFICIENT_INFORMATION",
    "ADDRESS.STREET.NOT_FOUND",
  ]);
  for (const code of allCodes) {
    if (addressCodes.has(code)) return "LOCATION_NOT_FOUND";
  }

  const unsupportedRouteCodes = new Set([
    "ADDRESS.COUNTRY.INVALID",
    "SHIPMENT.RATE.STAMP_UNAVAILABLE",
    "TRACKER.UNSUPPORTED_CARRIER",
  ]);
  for (const code of allCodes) {
    if (unsupportedRouteCodes.has(code)) return "UNSUPPORTED_ROUTE";
  }

  const invalidRequestCodes = new Set([
    "PARAMETER.REQUIRED",
    "PARAMETER.INVALID",
    "SHIPMENT.MISSING_INFORMATION",
    "ITEM.WEIGHT.REQUIRED",
    "CONTAINER.DIMENSION.REQUIRED",
  ]);
  for (const code of allCodes) {
    if (invalidRequestCodes.has(code)) return "INVALID_REQUEST";
  }

  // Fallback: inspect field names for address-related fields
  const addressFields = new Set(["to_address", "from_address", "address", "zip", "state", "city"]);
  const nestedFields = new Set(
    (payload.error?.errors ?? []).map((e) => (e.field ?? "").toLowerCase()),
  );
  for (const field of nestedFields) {
    if (addressFields.has(field)) return "LOCATION_NOT_FOUND";
  }

  return "UNKNOWN_PROVIDER_FAILURE";
}

function mapHttpFailure(
  status: number,
  payload: EasyPostErrorPayload,
): ProviderError {
  const message =
    payload.error?.message ??
    payload.error?.errors?.map((e) => e.message).filter(Boolean).join("; ") ??
    payload.error?.code ??
    `EasyPost request failed with status ${status}`;

  if (status === 401 || status === 403) {
    return new ProviderError("UPSTREAM_AUTH_FAILURE", message, {
      providerKey: "easypost",
    });
  }
  if (status === 429) {
    return new ProviderError("UPSTREAM_RATE_LIMIT", message, {
      providerKey: "easypost",
    });
  }
  if (status >= 500) {
    return new ProviderError("UPSTREAM_UNAVAILABLE", message, {
      providerKey: "easypost",
    });
  }

  const code = status >= 400 && status < 500
    ? classify4xxError(payload)
    : "UNKNOWN_PROVIDER_FAILURE";

  return new ProviderError(code, message, {
    providerKey: "easypost",
  });
}
