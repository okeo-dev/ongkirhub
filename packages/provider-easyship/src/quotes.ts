import type { Duration, Quote } from "@ongkirhub/core";
import type { EasyshipRate } from "./client.js";

export const EASYSHIP_PROVIDER_KEY = "easyship";

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

export function mapEasyshipRatesToQuotes(
  rates: EasyshipRate[],
  options?: { carrierFilter?: string[] },
): Quote[] {
  const normalizedFilter = options?.carrierFilter
    ?.map((c) => c.toLowerCase().trim())
    .filter(Boolean);

  return rates
    .filter((rate) => {
      if (!normalizedFilter || normalizedFilter.length === 0) return true;
      return normalizedFilter.includes(rate.courier_name.toLowerCase().trim());
    })
    .map((rate) => ({
      providerKey: EASYSHIP_PROVIDER_KEY,
      serviceCode: `${rate.courier_id}-${rate.service_level_name}`
        .toUpperCase()
        .replace(/\s+/g, "_"),
      serviceName: `${rate.courier_name} ${rate.service_level_name}`,
      price: {
        amount: rate.total_charge,
        currency: rate.currency,
      },
      estimatedDuration: parseEstimatedDuration(rate.delivery_days),
      eta: rate.estimated_delivery_date,
      metadata: {
        courierId: rate.courier_id,
        courierName: rate.courier_name,
        serviceLevelName: rate.service_level_name,
        incoterm: rate.incoterm,
        taxAndDuty: rate.tax_and_duty,
        surcharges: rate.surcharges,
        insuranceFee: rate.insurance_fee,
        pickupFee: rate.pickup_fee,
      },
    }));
}
