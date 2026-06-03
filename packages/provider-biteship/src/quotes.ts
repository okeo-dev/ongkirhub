import type { Duration, Quote } from "@ongkirhub/core";
import type { BiteshipPricing } from "./client.js";

export const BITESHIP_PROVIDER_KEY = "biteship";

export function parseEstimatedDuration(duration: string): Duration {
  const normalized = duration.trim().toLowerCase();

  const rangeDays = /^(\d+)\s*-\s*(\d+)\s*days?/.exec(normalized);
  if (rangeDays) {
    return { value: Number(rangeDays[1]), unit: "days" };
  }

  const singleDay = /^(\d+)\s*days?/.exec(normalized);
  if (singleDay) {
    return { value: Number(singleDay[1]), unit: "days" };
  }

  const rangeHours = /^(\d+)\s*-\s*(\d+)\s*hours?/.exec(normalized);
  if (rangeHours) {
    return { value: Number(rangeHours[1]), unit: "hours" };
  }

  const singleHour = /^(\d+)\s*hours?/.exec(normalized);
  if (singleHour) {
    return { value: Number(singleHour[1]), unit: "hours" };
  }

  return { value: 3, unit: "days" };
}

export function mapBiteshipPricingToQuotes(
  items: BiteshipPricing[],
): Quote[] {
  return items.map((item) => ({
    providerKey: BITESHIP_PROVIDER_KEY,
    serviceCode: `${item.courier_code}-${item.courier_service_code}`.toUpperCase(),
    serviceName: `${item.courier_name} ${item.courier_service_name}`,
    price: {
      amount: item.price,
      currency: item.currency,
    },
    estimatedDuration: parseEstimatedDuration(item.duration),
    eta: item.duration,
    metadata: {
      courierCode: item.courier_code,
      courierName: item.courier_name,
      serviceCode: item.courier_service_code,
      serviceName: item.courier_service_name,
      company: item.company,
      description: item.description,
      serviceType: item.service_type,
      shippingType: item.shipping_type,
      shippingFee: item.shipping_fee,
      shippingFeeDiscount: item.shipping_fee_discount,
      shippingFeeSurcharge: item.shipping_fee_surcharge,
      insuranceFee: item.insurance_fee,
      codFee: item.cash_on_delivery_fee,
      rawDuration: item.duration,
    },
  }));
}
