export interface ApiEnv {
  port: number;
  host: string;
  enabledProviders: string[];
}

function parseProviderList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return ["mock", "manual"];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadEnv(
  env: NodeJS.ProcessEnv = process.env,
): ApiEnv {
  const port = Number(env.PORT ?? "3000");
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("PORT must be a positive number");
  }

  return {
    port,
    host: env.HOST ?? "0.0.0.0",
    enabledProviders: parseProviderList(env.ENABLED_PROVIDERS),
  };
}
