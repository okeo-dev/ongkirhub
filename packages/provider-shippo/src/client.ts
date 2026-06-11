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
  [key: string]: unknown;
}

export interface ShippoClientConfig {
  apiKey: string;
  baseUrl: string;
  fetchFn?: FetchFn;
  debug?: boolean;
}

interface ShippoRawResponse {
  status: number;
  ok: boolean;
  payload?: ShippoShipment | ShippoErrorPayload;
  rawText?: string;
}

export interface ShippoCustomsItem {
  description: string;
  quantity: number;
  net_weight: string;
  mass_unit: string;
  value_amount: string;
  value_currency: string;
  origin_country: string;
  hs_code?: string;
}

export interface ShippoCustomsDeclaration {
  certify: boolean;
  certify_signer: string;
  contents_type: string;
  contents_explanation?: string;
  eel_pfc?: string;
  items: ShippoCustomsItem[];
}

export interface CreateShipmentParams {
  fromAddress: ShippoAddress;
  toAddress: ShippoAddress;
  parcel: ShippoParcel;
  customsDeclaration?: ShippoCustomsDeclaration;
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
      ...(params.customsDeclaration
        ? { customs_declaration: params.customsDeclaration }
        : {}),
    });

    if (this.debug) {
      console.dir(
        {
          shippoRequest: {
            url: `${this.baseUrl}/shipments`,
            fromAddress: params.fromAddress,
            toAddress: params.toAddress,
            parcel: params.parcel,
            customsDeclaration: params.customsDeclaration,
          },
        },
        { depth: null },
      );
    }

    const response = await this.fetchFn(`${this.baseUrl}/shipments`, {
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
          shippoResponse: parsed,
        },
        { depth: null },
      );
    }

    if (!response.ok) {
      throw mapHttpFailure(
        parsed.status,
        parsed.payload as ShippoErrorPayload | undefined,
        parsed.rawText,
      );
    }

    if (!parsed.payload) {
      throw new ProviderError(
        "UPSTREAM_UNAVAILABLE",
        "Shippo returned a non-JSON response",
        { providerKey: "shippo" },
      );
    }

    const payload = parsed.payload;
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

async function readResponse(response: Response): Promise<ShippoRawResponse> {
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
      payload: JSON.parse(trimmed) as ShippoShipment | ShippoErrorPayload,
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

function flattenValidationMessages(value: unknown, path = ""): string[] {
  if (typeof value === "string" && value.trim() !== "") {
    return [path ? `${path}: ${value}` : value];
  }

  if (Array.isArray(value)) {
    const flattened = value.flatMap((entry) =>
      flattenValidationMessages(entry, path),
    );
    return flattened;
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, nested]) => {
        const nextPath = path ? `${path}.${key}` : key;
        return flattenValidationMessages(nested, nextPath);
      },
    );
  }

  return [];
}

function extractErrorText(payload: ShippoErrorPayload): string {
  const parts: string[] = [];

  const messageText = joinMessages(payload.messages);
  if (messageText) {
    parts.push(messageText);
  }

  if (typeof payload.detail === "string" && payload.detail.trim() !== "") {
    parts.push(payload.detail);
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key === "messages" || key === "detail") continue;
    parts.push(...flattenValidationMessages(value, key));
  }

  return parts.join("; ");
}

function classify4xxError(payload: ShippoErrorPayload): ProviderErrorCode {
  const messages = payload.messages ?? [];
  const allText = extractErrorText(payload).toLowerCase();
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
  payload: ShippoErrorPayload | undefined,
  rawText?: string,
): ProviderError {
  const message = payload
    ? extractErrorText(payload)
    : undefined;

  const fallbackMessage =
    rawText && rawText.trim() !== ""
      ? `Shippo returned a non-JSON error response (status ${status})`
      : `Shippo request failed with status ${status}`;

  const finalMessage = message || fallbackMessage;

  if (status === 401 || status === 403) {
    return new ProviderError("UPSTREAM_AUTH_FAILURE", finalMessage, {
      providerKey: "shippo",
    });
  }
  if (status === 429) {
    return new ProviderError("UPSTREAM_RATE_LIMIT", finalMessage, {
      providerKey: "shippo",
    });
  }
  if (status >= 500) {
    return new ProviderError("UPSTREAM_UNAVAILABLE", finalMessage, {
      providerKey: "shippo",
    });
  }

  const code =
    status >= 400 && status < 500 && payload
      ? classify4xxError(payload)
      : "UNKNOWN_PROVIDER_FAILURE";

  return new ProviderError(code, finalMessage, { providerKey: "shippo" });
}
