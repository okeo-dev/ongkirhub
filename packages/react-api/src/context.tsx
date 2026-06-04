import { createContext, useContext } from "react";
import type { OngkirHubClient } from "@ongkirhub/client";

export const OngkirHubContext = createContext<OngkirHubClient | null>(null);

export function useOngkirHubClient(): OngkirHubClient {
  const client = useContext(OngkirHubContext);
  if (client === null) {
    throw new Error(
      "useOngkirHubClient must be used within an OngkirHubProvider",
    );
  }
  return client;
}
