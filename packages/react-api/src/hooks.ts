import { useCallback, useEffect, useRef, useState } from "react";
import type { QuoteRequest } from "@ongkirhub/client";
import { isOngkirHubError, OngkirHubError } from "@ongkirhub/client";
import { useOngkirHubClient } from "./context.js";
import type { UseShippingQuotesOptions, UseShippingQuotesResult } from "./types.js";

export function useShippingQuotes(
  request: QuoteRequest,
  options: UseShippingQuotesOptions = {},
): UseShippingQuotesResult {
  const client = useOngkirHubClient();
  const enabled = options.enabled ?? true;

  const [quotes, setQuotes] = useState<UseShippingQuotesResult["quotes"]>(
    undefined,
  );
  const [providers, setProviders] = useState<
    UseShippingQuotesResult["providers"]
  >(undefined);
  const [requestSummary, setRequestSummary] = useState<
    UseShippingQuotesResult["requestSummary"]
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<OngkirHubError | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Use a ref to track the latest request for stale-data guard
  const requestRef = useRef(request);
  requestRef.current = request;

  // Derive a stable key so the effect reacts to request changes
  const requestKey = JSON.stringify(request);

  const performFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await client.getQuotes(requestRef.current);
      setQuotes(response.quotes);
      setProviders(response.providers);
      setRequestSummary(response.requestSummary);
      setHasFetched(true);
    } catch (err) {
      if (isOngkirHubError(err)) {
        setError(err);
      } else if (err instanceof Error) {
        setError(
          new OngkirHubError("UNKNOWN_ERROR", err.message),
        );
      } else {
        setError(new OngkirHubError("UNKNOWN_ERROR", "An unknown error occurred"));
      }
      setHasFetched(true);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void performFetch();
  }, [enabled, performFetch, requestKey]);

  const refetch = useCallback(() => {
    void performFetch();
  }, [performFetch]);

  const isIdle = !hasFetched && !isLoading;
  const isSuccess = hasFetched && !isLoading && error === null;

  return {
    quotes,
    providers,
    requestSummary,
    isIdle,
    isLoading,
    isSuccess,
    error,
    refetch,
  };
}
