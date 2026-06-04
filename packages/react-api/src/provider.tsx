import type { ReactNode } from "react";
import { OngkirHubContext } from "./context.js";
import type { OngkirHubClient } from "@ongkirhub/client";

export interface OngkirHubProviderProps {
  client: OngkirHubClient;
  children: ReactNode;
}

export function OngkirHubProvider({ client, children }: OngkirHubProviderProps): ReactNode {
  return (
    <OngkirHubContext.Provider value={client}>
      {children}
    </OngkirHubContext.Provider>
  );
}
