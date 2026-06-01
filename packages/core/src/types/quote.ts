import type { Money } from "./shipment.js";

export type DurationUnit = "hours" | "days";

export interface Duration {
  value: number;
  unit: DurationUnit;
}

export interface Quote {
  providerKey: string;
  serviceCode: string;
  serviceName: string;
  price: Money;
  estimatedDuration: Duration;
  eta?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}
