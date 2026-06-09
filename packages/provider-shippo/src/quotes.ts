import type { Duration, Quote } from "@ongkirhub/core";
import type { ShippoRate } from "./client.js";

export const SHIPPO_PROVIDER_KEY = "shippo";

export function parseEstimatedDuration(days: number | undefined): Duration {
  if (
    typeof days === "number" &&
    Number.isFinite(days) &&
    days >= 0
  ) {
    return { value: days, unit: "days" };
  }
  return { value: 3, unit: "days" };
}

export function mapShippoRatesToQuotes(
  rates: ShippoRate[],
  options?: { carrierFilter?: string[] },
): Quote[] {
  const normalizedFilter = options?.carrierFilter
    ?.map((c) => c.toLowerCase().trim())
    .filter(Boolean);

  return rates
    .filter((rate) => {
      if (!normalizedFilter || normalizedFilter.length === 0) return true;
      return normalizedFilter.includes(rate.provider.toLowerCase().trim());
    })
    .map((rate) => ({
      providerKey: SHIPPO_PROVIDER_KEY,
      serviceCode: `${rate.provider}-${rate.servicelevel.token}`
        .toUpperCase()
        .replace(/\s+/g, "_"),
      serviceName: `${rate.provider} ${rate.servicelevel.name}`,
      price: {
        amount: Number(rate.amount),
        currency: rate.currency,
      },
      estimatedDuration: parseEstimatedDuration(rate.days),
      eta: rate.arrives_by ?? undefined,
      metadata: {
        carrier: rate.provider,
        serviceLevelToken: rate.servicelevel.token,
        serviceLevelName: rate.servicelevel.name,
        rateId: rate.object_id,
        carrierAccountId: rate.carrier_account,
        durationTerms: rate.duration_terms,
        attributes: rate.attributes,
        zone: rate.zone,
        providerImage75: rate.provider_image_75,
        providerImage200: rate.provider_image_200,
        amountLocal: rate.amount_local,
        currencyLocal: rate.currency_local,
        test: rate.test,
      },
    }));
}
