import { ProviderError } from "@ongkirhub/core";
import {
  RAJAONGKIR_COUNTRY_RECORDS,
  type RajaOngkirCountryRecord,
} from "./international-countries.generated.js";

export const RAJAONGKIR_INTERNATIONAL_PROVIDER_KEY = "rajaongkir";

export function resolveCountryId(
  countryCode: string,
  records: RajaOngkirCountryRecord[] = RAJAONGKIR_COUNTRY_RECORDS,
): RajaOngkirCountryRecord {
  const normalizedCode = countryCode.trim().toUpperCase();
  const record = records.find((r) => r.countryCode === normalizedCode);

  if (!record) {
    throw new ProviderError(
      "LOCATION_NOT_FOUND",
      `RajaOngkir does not support shipping to country: ${countryCode}`,
      { providerKey: RAJAONGKIR_INTERNATIONAL_PROVIDER_KEY },
    );
  }

  return record;
}
