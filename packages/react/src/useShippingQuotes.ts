import { useCallback, useEffect, useRef, useState } from "react";
import type { Quote, QuoteRequest } from "@ongkirhub/core";
import { ProviderError } from "@ongkirhub/core";
import { useOngkirHub } from "./context.js";

export interface UseShippingQuotesOptions {
  enabled?: boolean;
}

export interface UseShippingQuotesResult {
  quotes: Quote[] | undefined;
  providers: string[] | undefined;
  isIdle: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  error: ProviderError | null;
  refetch: () => void;
}

export function useShippingQuotes(
  request: QuoteRequest,
  options: UseShippingQuotesOptions = {},
): UseShippingQuotesResult {
  const hub = useOngkirHub();
  const enabled = options.enabled ?? true;

  const [quotes, setQuotes] = useState<Quote[] | undefined>(undefined);
  const [providers, setProviders] = useState<string[] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ProviderError | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const requestRef = useRef(request);
  requestRef.current = request;

  const requestKey = JSON.stringify(request);

  const performFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await hub.getQuotes(requestRef.current);
      setQuotes(result.quotes);
      setProviders(result.providers);
      setHasFetched(true);
    } catch (err) {
      if (err instanceof ProviderError) {
        setError(err);
      } else if (err instanceof Error) {
        setError(new ProviderError("UNKNOWN_PROVIDER_FAILURE", err.message));
      } else {
        setError(new ProviderError("UNKNOWN_PROVIDER_FAILURE", "An unknown error occurred"));
      }
      setHasFetched(true);
    } finally {
      setIsLoading(false);
    }
  }, [hub]);

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
    isIdle,
    isLoading,
    isSuccess,
    error,
    refetch,
  };
}
