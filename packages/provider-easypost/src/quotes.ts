import type { Duration, Quote } from "@ongkirhub/core";
import type { EasyPostRate } from "./client.js";

export const EASYPOST_PROVIDER_KEY = "easypost";

export function parseEstimatedDuration(
  deliveryDays: number | undefined,
): Duration {
  if (typeof deliveryDays === "number" && Number.isFinite(deliveryDays) && deliveryDays >= 0) {
    return { value: deliveryDays, unit: "days" };
  }
  return { value: 3, unit: "days" };
}

export function mapEasyPostRatesToQuotes(
  rates: EasyPostRate[],
  options?: { carrierFilter?: string[] },
): Quote[] {
  const normalizedFilter = options?.carrierFilter?.map((c) => c.toLowerCase().trim()).filter(Boolean);

  return rates
    .filter((rate) => {
      if (!normalizedFilter || normalizedFilter.length === 0) return true;
      return normalizedFilter.includes(rate.carrier.toLowerCase().trim());
    })
    .map((rate) => ({
      providerKey: EASYPOST_PROVIDER_KEY,
      serviceCode: `${rate.carrier}-${rate.service}`.toUpperCase().replace(/\s+/g, "_"),
      serviceName: `${rate.carrier} ${rate.service}`,
      price: {
        amount: Number(rate.rate),
        currency: rate.currency,
      },
      estimatedDuration: parseEstimatedDuration(
        rate.delivery_days ?? rate.est_delivery_days,
      ),
      eta: rate.delivery_date,
      metadata: {
        carrier: rate.carrier,
        service: rate.service,
        rateId: rate.id,
        carrierAccountId: rate.carrier_account_id,
        shipmentId: rate.shipment_id,
        listRate: rate.list_rate,
        listCurrency: rate.list_currency,
        retailRate: rate.retail_rate,
        retailCurrency: rate.retail_currency,
        billingType: rate.billing_type,
        deliveryDateGuaranteed: rate.delivery_date_guaranteed,
      },
    }));
}
