import type { Duration, Quote } from "@ongkirhub/core";
import type { RajaOngkirCostItem } from "./client.js";
import { RAJAONGKIR_PROVIDER_KEY } from "./location/resolve.js";

export function parseEstimatedDuration(etd: string): Duration {
  const normalized = etd.trim().toLowerCase();

  const rangeDays = /^(\d+)\s*-\s*(\d+)\s*day/.exec(normalized);
  if (rangeDays) {
    return { value: Number(rangeDays[1]), unit: "days" };
  }

  const singleDay = /^(\d+)\s*day/.exec(normalized);
  if (singleDay) {
    return { value: Number(singleDay[1]), unit: "days" };
  }

  const rangeHours = /^(\d+)\s*-\s*(\d+)\s*hour/.exec(normalized);
  if (rangeHours) {
    return { value: Number(rangeHours[1]), unit: "hours" };
  }

  const singleHour = /^(\d+)\s*hour/.exec(normalized);
  if (singleHour) {
    return { value: Number(singleHour[1]), unit: "hours" };
  }

  return { value: 3, unit: "days" };
}

export function mapRajaOngkirCostsToQuotes(items: RajaOngkirCostItem[]): Quote[] {
  return items.map((item) => ({
    providerKey: RAJAONGKIR_PROVIDER_KEY,
    serviceCode: `${item.code}-${item.service}`.toUpperCase(),
    serviceName: item.description || `${item.name} ${item.service}`,
    price: {
      amount: item.cost,
      currency: "IDR",
    },
    estimatedDuration: parseEstimatedDuration(item.etd),
    eta: item.etd,
    metadata: {
      courierCode: item.code,
      courierName: item.name,
      service: item.service,
      rawEtd: item.etd,
    },
  }));
}
