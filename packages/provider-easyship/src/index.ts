export {
  DEFAULT_EASYSHIP_BASE_URL,
  type EasyshipEnvConfig,
  type EasyshipProviderConfig,
  loadEasyshipConfigFromEnv,
  requireEasyshipConfigFromEnv,
  validateEasyshipProviderConfig,
} from "./config.js";
export {
  EasyshipClient,
  type EasyshipAddress,
  type EasyshipBox,
  type EasyshipClientConfig,
  type EasyshipErrorPayload,
  type EasyshipParcel,
  type EasyshipRate,
  type EasyshipRatesResponse,
  type FetchFn,
  type RequestRatesParams,
} from "./client.js";
export {
  createEasyshipProvider,
  type EasyshipProvider,
} from "./provider.js";
export {
  EASYSHIP_PROVIDER_KEY,
  mapEasyshipRatesToQuotes,
  parseEstimatedDuration,
} from "./quotes.js";
