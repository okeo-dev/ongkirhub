import { createContext, useContext } from "react";
import type { OngkirHub } from "@ongkirhub/runtime";

export const OngkirHubContext = createContext<OngkirHub | null>(null);

export function useOngkirHub(): OngkirHub {
  const hub = useContext(OngkirHubContext);
  if (!hub) {
    throw new Error("useOngkirHub must be used within an OngkirHubProvider");
  }
  return hub;
}
