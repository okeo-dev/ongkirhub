import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OngkirHubClient } from "@ongkirhub/client";
import { OngkirHubProvider } from "@ongkirhub/react-api";
import { App } from "./App.js";

// Vite dev proxy forwards /health and /v0 to the API server
const client = new OngkirHubClient({ baseUrl: "" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OngkirHubProvider client={client}>
      <App />
    </OngkirHubProvider>
  </StrictMode>,
);
