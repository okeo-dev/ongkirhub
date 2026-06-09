import { ProviderError, type ProviderErrorCode } from "@ongkirhub/core";

export type FetchFn = typeof fetch;

export interface EasyshipAddress {
  state?: string;
  city?: string;
  postal_code?: string;
  line_1?: string;
  country_alpha2: string;
}

export interface EasyshipBox {
  length: number;
  width: number;
  height: number;
}

export interface EasyshipDimensions {
  length: number;
  width: number;
  height: number;
}

export interface EasyshipParcel {
  total_actual_weight?: number;
  box?: EasyshipBox;
  items: EasyshipItem[];
}

export interface EasyshipItem {
  description: string;
  category: string;
  quantity: number;
  actual_weight: number;
  declared_currency: string;
  declared_customs_value: number;
  hs_code?: string;
  dimensions?: EasyshipDimensions;
}

export interface EasyshipRate {
  courier_id: string;
  courier_name: string;
  service_level_name: string;
  total_charge: number;
  currency: string;
  delivery_days?: number;
  estimated_delivery_date?: string;
  incoterm?: string;
  tax_and_duty?: { total: number; details?: unknown[] };
  surcharges?: unknown[];
  insurance_fee?: number;
  pickup_fee?: number;
}

export interface EasyshipRatesResponse {
  rates: EasyshipRate[];
}

export interface EasyshipErrorPayload {
  error?:
    | string
    | {
        code?: string;
        message?: string;
        details?: unknown[];
        type?: string;
      };
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}

export interface EasyshipClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchFn?: FetchFn;
  debug?: boolean;
}

interface EasyshipRawResponse {
  status: number;
  ok: boolean;
  payload?: EasyshipRatesResponse | EasyshipErrorPayload;
  rawText?: string;
}

export interface RequestRatesParams {
  originAddress: EasyshipAddress;
  destinationAddress: EasyshipAddress;
  parcel: EasyshipParcel;
  setAsResidential?: boolean;
  incoterms?: "DDU" | "DDP" | null;
  calculateTaxAndDuties?: boolean;
}

function encodeAuth(apiKey: string): string {
  return `Bearer ${apiKey}`;
}

export class EasyshipClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly debug: boolean;

  constructor(config: EasyshipClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchFn =
      config.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.debug = config.debug ?? false;
  }

  async requestRates(params: RequestRatesParams): Promise<EasyshipRatesResponse> {
    const body = JSON.stringify({
      origin_address: params.originAddress,
      destination_address: params.destinationAddress,
      incoterms: params.incoterms ?? "DDU",
      insurance: { is_insured: false },
      courier_settings: {
        show_courier_logo_url: false,
        apply_shipping_rules: true,
      },
      shipping_settings: {
        units: {
          weight: "kg",
          dimensions: "cm",
        },
      },
      parcels: [params.parcel],
      calculate_tax_and_duties: params.calculateTaxAndDuties ?? true,
      ...(params.setAsResidential !== undefined
        ? { set_as_residential: params.setAsResidential }
        : {}),
    });

    if (this.debug) {
      console.dir(
        {
          easyshipRequest: {
            url: `${this.baseUrl}/2024-09/rates`,
            originAddress: params.originAddress,
            destinationAddress: params.destinationAddress,
            parcel: params.parcel,
          },
        },
        { depth: null },
      );
    }

    const response = await this.fetchFn(`${this.baseUrl}/2024-09/rates`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: encodeAuth(this.apiKey),
        "content-type": "application/json",
      },
      body,
    });

    const parsed = await readResponse(response);

    if (this.debug) {
      console.dir(
        {
          easyshipResponse: parsed,
        },
        { depth: null },
      );
    }

    if (!response.ok) {
      throw mapHttpFailure(
        parsed.status,
        parsed.payload as EasyshipErrorPayload | undefined,
        parsed.rawText,
      );
    }

    if (!parsed.payload) {
      throw new ProviderError(
        "UPSTREAM_UNAVAILABLE",
        "Easyship returned a non-JSON response",
        { providerKey: "easyship" },
      );
    }

    const payload = parsed.payload;
    if (!isRatesResponse(payload)) {
      throw new ProviderError(
        "UNKNOWN_PROVIDER_FAILURE",
        "Easyship response did not include rates",
        { providerKey: "easyship" },
      );
    }

    return payload;
  }
}

async function readResponse(response: Response): Promise<EasyshipRawResponse> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed === "") {
    return {
      status: response.status,
      ok: response.ok,
      rawText,
    };
  }

  try {
    return {
      status: response.status,
      ok: response.ok,
      payload: JSON.parse(trimmed) as EasyshipRatesResponse | EasyshipErrorPayload,
      rawText,
    };
  } catch {
    return {
      status: response.status,
      ok: response.ok,
      rawText,
    };
  }
}

function isRatesResponse(payload: unknown): payload is EasyshipRatesResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "rates" in payload &&
    Array.isArray((payload as Record<string, unknown>).rates)
  );
}

function classify4xxError(payload: EasyshipErrorPayload): ProviderErrorCode {
  const message = extractErrorText(payload).toLowerCase();

  if (message.includes("authentication") || message.includes("unauthorized") || message.includes("invalid token")) {
    return "UPSTREAM_AUTH_FAILURE";
  }

  if (
    message.includes("route not found") ||
    message.includes("country") ||
    message.includes("unsupported") ||
    message.includes("not available") ||
    message.includes("unavailable")
  ) {
    return "UNSUPPORTED_ROUTE";
  }

  if (
    message.includes("address") ||
    message.includes("postal_code") ||
    message.includes("city") ||
    message.includes("state")
  ) {
    return "LOCATION_NOT_FOUND";
  }

  if (
    message.includes("weight") ||
    message.includes("parcel") ||
    message.includes("dimensions") ||
    message.includes("required") ||
    message.includes("missing")
  ) {
    return "INVALID_REQUEST";
  }

  return "UNKNOWN_PROVIDER_FAILURE";
}

function extractErrorText(payload: EasyshipErrorPayload): string {
  const parts: string[] = [];

  if (typeof payload.message === "string" && payload.message.trim() !== "") {
    parts.push(payload.message);
  }

  if (typeof payload.error === "string" && payload.error.trim() !== "") {
    parts.push(payload.error);
  } else if (payload.error && typeof payload.error === "object") {
    if (
      typeof payload.error.message === "string" &&
      payload.error.message.trim() !== ""
    ) {
      parts.push(payload.error.message);
    }
    if (
      typeof payload.error.code === "string" &&
      payload.error.code.trim() !== ""
    ) {
      parts.push(payload.error.code);
    }
    if (Array.isArray(payload.error.details)) {
      parts.push(
        ...payload.error.details.filter(
          (detail): detail is string => typeof detail === "string",
        ),
      );
    }
    if (
      typeof payload.error.type === "string" &&
      payload.error.type.trim() !== ""
    ) {
      parts.push(payload.error.type);
    }
  }

  if (Array.isArray(payload.errors)) {
    parts.push(
      ...payload.errors
        .map((error) => error.message)
        .filter((message): message is string => typeof message === "string" && message.trim() !== ""),
    );
  }

  return parts.join("; ");
}

function mapHttpFailure(
  status: number,
  payload: EasyshipErrorPayload | undefined,
  rawText?: string,
): ProviderError {
  const message = payload
    ? extractErrorText(payload)
    : undefined;

  const fallbackMessage =
    rawText && rawText.trim() !== ""
      ? `Easyship returned a non-JSON error response (status ${status})`
      : `Easyship request failed with status ${status}`;

  const finalMessage = message || fallbackMessage;

  if (status === 401 || status === 403) {
    return new ProviderError("UPSTREAM_AUTH_FAILURE", finalMessage, {
      providerKey: "easyship",
    });
  }
  if (status === 429) {
    return new ProviderError("UPSTREAM_RATE_LIMIT", finalMessage, {
      providerKey: "easyship",
    });
  }
  if (status >= 500) {
    return new ProviderError("UPSTREAM_UNAVAILABLE", finalMessage, {
      providerKey: "easyship",
    });
  }

  const code =
    status >= 400 && status < 500 && payload
      ? classify4xxError(payload)
      : "UNKNOWN_PROVIDER_FAILURE";

  return new ProviderError(code, finalMessage, { providerKey: "easyship" });
}
