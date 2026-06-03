import { OngkirHubError } from "./errors.js";
import type {
  HealthResponseBody,
  OngkirHubClientConfig,
  QuoteRequest,
  QuotesResponseBody,
} from "./types.js";

export type FetchFn = typeof fetch;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new OngkirHubError(
        "TIMEOUT_ERROR",
        `Request timed out after ${timeoutMs}ms`,
        { url },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class OngkirHubClient {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;
  private readonly timeoutMs: number;

  constructor(config: OngkirHubClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.fetchFn = config.fetchFn ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  async getQuotes(request: QuoteRequest): Promise<QuotesResponseBody> {
    return this.requestWithRetry(
      "POST",
      "/v0/quotes",
      request,
      { retryOn4xx: false },
    );
  }

  async getHealth(): Promise<HealthResponseBody> {
    return this.requestWithRetry(
      "GET",
      "/health",
      undefined,
      { retryOn4xx: false },
    );
  }

  private async requestWithRetry<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    options: { retryOn4xx: boolean },
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const maxAttempts = 3;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.requestOnce<T>(method, url, body);
      } catch (error) {
        lastError = error;

        if (this.isRetryable(error, attempt, maxAttempts, options.retryOn4xx)) {
          await sleep(1000 * attempt);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private isRetryable(
    error: unknown,
    attempt: number,
    maxAttempts: number,
    retryOn4xx: boolean,
  ): boolean {
    if (attempt >= maxAttempts) return false;
    if (!(error instanceof OngkirHubError)) return false;

    // Never retry parse errors — the server responded, just with bad data.
    if (error.code === "PARSE_ERROR") return false;

    // Network and timeout errors are transient — retry them.
    if (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT_ERROR") {
      return true;
    }

    const status = error.context.status;
    if (status === undefined) return false;

    if (status >= 500) return true;
    if (status >= 400 && status < 500) return retryOn4xx;

    return false;
  }

  private async requestOnce<T>(
    method: string,
    url: string,
    body: unknown | undefined,
  ): Promise<T> {
    const init: RequestInit = {
      method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(this.fetchFn, url, init, this.timeoutMs);
    } catch (error) {
      if (error instanceof OngkirHubError && error.code === "TIMEOUT_ERROR") {
        throw error;
      }
      throw new OngkirHubError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Network request failed",
        { url },
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OngkirHubError(
        "PARSE_ERROR",
        `Response from ${url} was not valid JSON`,
        { status: response.status, url },
      );
    }

    if (!response.ok) {
      const errorPayload = payload as Record<string, unknown>;
      const message =
        typeof errorPayload.error === "string"
          ? errorPayload.error
          : typeof errorPayload.message === "string"
            ? errorPayload.message
            : `Request failed with status ${response.status}`;

      const code = this.inferErrorCode(response.status, errorPayload);

      throw new OngkirHubError(code, message, {
        status: response.status,
        url,
        details: errorPayload.details ?? undefined,
        providerKey:
          typeof errorPayload.providerKey === "string"
            ? errorPayload.providerKey
            : undefined,
      });
    }

    return payload as T;
  }

  private inferErrorCode(
    status: number,
    payload: Record<string, unknown>,
  ): OngkirHubError["code"] {
    if (status === 400) {
      return "VALIDATION_ERROR";
    }
    if (status === 502) {
      return "PROVIDER_ERROR";
    }
    if (status >= 500) {
      return "UPSTREAM_ERROR";
    }
    if (payload.providerKey !== undefined) {
      return "PROVIDER_ERROR";
    }
    return "UNKNOWN_ERROR";
  }
}
