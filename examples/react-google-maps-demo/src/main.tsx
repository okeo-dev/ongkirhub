import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OngkirHubClient } from "@ongkirhub/client";
import { OngkirHubProvider } from "@ongkirhub/react";
import { App } from "./App.js";

const client = new OngkirHubClient({ baseUrl: "" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <OngkirHubProvider client={client}>
      <App />
    </OngkirHubProvider>
  </StrictMode>,
);
