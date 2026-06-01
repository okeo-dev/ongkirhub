import type { Quote } from "@ongkirhub/core";

export interface QuotesResponseBody {
  quotes: Quote[];
  providers: string[];
}
