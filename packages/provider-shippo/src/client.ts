import { ProviderError, type ProviderErrorCode } from "@ongkirhub/core";

export type FetchFn = typeof fetch;

export interface ShippoAddress {
  name?: string;
  company?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

export interface ShippoParcel {
  length?: number;
  width?: number;
  height?: number;
  distance_unit?: "cm" | "in" | "ft" | "mm" | "m" | "yd";
  weight: number;
  mass_unit?: "g" | "kg" | "lb" | "oz";
}

export interface ShippoServiceLevel {
  name: string;
  token: string;
  terms?: string;
  extended_token?: string;
  parent_servicelevel?: string | null;
}

export interface ShippoRate {
  object_id: string;
  amount: string;
  currency: string;
  amount_local?: string;
  currency_local?: string;
  provider: string;
  provider_image_75?: string;
  provider_image_200?: string;
  servicelevel: ShippoServiceLevel;
  days?: number;
  duration_terms?: string;
  arrives_by?: string | null;
  attributes?: string[];
  zone?: string;
  carrier_account?: string;
  test?: boolean;
}

export interface ShippoMessage {
  source?: string;
  code?: string;
  text: string;
}

export interface ShippoShipment {
  object_id: string;
  object_status?: string;
  address_from?: ShippoAddress;
  address_to?: ShippoAddress;
  parcels?: ShippoParcel[];
  rates: ShippoRate[];
  messages?: ShippoMessage[];
}

export interface ShippoErrorPayload {
  messages?: ShippoMessage[];
  detail?: string;
}

export interface ShippoClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchFn?: FetchFn;
  debug?: boolean;
}

export interface CreateShipmentParams {
  fromAddress: ShippoAddress;
  toAddress: ShippoAddress;
  parcel: ShippoParcel;
}

function encodeAuth(apiKey: string): string {
  return `ShippoToken ${apiKey}`;
}

export class ShippoClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly debug: boolean;

  constructor(config: ShippoClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchFn =
      config.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.debug = config.debug ?? false;
  }

  async createShipment(params: CreateShipmentParams): Promise<ShippoShipment> {
    const body = JSON.stringify({
      address_from: params.fromAddress,
      address_to: params.toAddress,
      parcels: [params.parcel],
      async: false,
    });

    if (this.debug) {
      console.log("[shippo] request", {
        url: `${this.baseUrl}/shipments`,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        parcel: params.parcel,
      });
    }

    const response = await this.fetchFn(`${this.baseUrl}/shipments`, {
      method: "POST",
      headers: {
        authorization: encodeAuth(this.apiKey),
        "content-type": "application/json",
      },
      body,
    });

    const payload = (await response.json()) as ShippoShipment | ShippoErrorPayload;

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
      throw mapHttpFailure(response.status, payload as ShippoErrorPayload);
    }

    if (!isShipment(payload)) {
      throw new ProviderError(
        "UNKNOWN_PROVIDER_FAILURE",
        "Shippo response did not include shipment rates",
        { providerKey: "shippo" },
      );
    }

    const softError = extractFirstError(payload.messages);
    if (softError && payload.rates.length === 0) {
      throw mapSoftError(softError);
    }

    return payload;
  }
}

function isShipment(payload: unknown): payload is ShippoShipment {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "object_id" in payload &&
    "rates" in payload &&
    Array.isArray((payload as Record<string, unknown>).rates)
  );
}

function extractFirstError(
  messages: ShippoMessage[] | undefined,
): ShippoMessage | undefined {
  if (!messages || messages.length === 0) return undefined;
  return messages.find((m) => {
    const code = m.code?.trim().toLowerCase() ?? "";
    const text = m.text?.toLowerCase() ?? "";
    return (
      code.startsWith("4") ||
      code.startsWith("5") ||
      text.includes("error") ||
      text.includes("invalid") ||
      text.includes("failed") ||
      text.includes("required") ||
      text.includes("not found") ||
      text.includes("unable")
    );
  });
}

function joinMessages(messages: ShippoMessage[] | undefined): string {
  if (!messages || messages.length === 0) return "";
  return messages.map((m) => m.text).filter(Boolean).join("; ");
}

function classify4xxError(payload: ShippoErrorPayload): ProviderErrorCode {
  const messages = payload.messages ?? [];
  const allText = messages.map((m) => m.text.toLowerCase()).join(" ");
  const allCodes = new Set(
    messages.map((m) => m.code?.trim().toLowerCase() ?? "").filter(Boolean),
  );

  for (const code of allCodes) {
    if (code === "400" || code.startsWith("400")) {
      if (
        allText.includes("weight") ||
        allText.includes("parcel") ||
        allText.includes("required")
      ) {
        return "INVALID_REQUEST";
      }
    }
    if (
      code === "401" ||
      code === "403" ||
      code.startsWith("401") ||
      code.startsWith("403")
    ) {
      return "UPSTREAM_AUTH_FAILURE";
    }
  }

  if (
    allText.includes("authentication") ||
    allText.includes("credentials") ||
    allText.includes("api key") ||
    allText.includes("apikey")
  ) {
    return "UPSTREAM_AUTH_FAILURE";
  }

  if (
    allText.includes("address") ||
    allText.includes("zip") ||
    allText.includes("postal") ||
    allText.includes("city") ||
    allText.includes("state")
  ) {
    return "LOCATION_NOT_FOUND";
  }

  if (
    allText.includes("country") ||
    allText.includes("unsupported") ||
    allText.includes("not available") ||
    allText.includes("no rates")
  ) {
    return "UNSUPPORTED_ROUTE";
  }

  if (
    allText.includes("weight") ||
    allText.includes("parcel") ||
    allText.includes("required") ||
    allText.includes("missing") ||
    allText.includes("invalid parameter")
  ) {
    return "INVALID_REQUEST";
  }

  return "UNKNOWN_PROVIDER_FAILURE";
}

function mapSoftError(message: ShippoMessage): ProviderError {
  const payload: ShippoErrorPayload = { messages: [message] };
  const code = classify4xxError(payload);
  return new ProviderError(code, message.text, { providerKey: "shippo" });
}

function mapHttpFailure(
  status: number,
  payload: ShippoErrorPayload,
): ProviderError {
  const message =
    joinMessages(payload.messages) ||
    payload.detail ||
    `Shippo request failed with status ${status}`;

  if (status === 401 || status === 403) {
    return new ProviderError("UPSTREAM_AUTH_FAILURE", message, {
      providerKey: "shippo",
    });
  }
  if (status === 429) {
    return new ProviderError("UPSTREAM_RATE_LIMIT", message, {
      providerKey: "shippo",
    });
  }
  if (status >= 500) {
    return new ProviderError("UPSTREAM_UNAVAILABLE", message, {
      providerKey: "shippo",
    });
  }

  const code =
    status >= 400 && status < 500
      ? classify4xxError(payload)
      : "UNKNOWN_PROVIDER_FAILURE";

  return new ProviderError(code, message, { providerKey: "shippo" });
}
