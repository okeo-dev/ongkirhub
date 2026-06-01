import type { LocationInput } from "../location/input.js";

export interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface Parcel {
  weightGrams: number;
  dimensions?: Dimensions;
  quantity?: number;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface QuoteRequest {
  origin: LocationInput;
  destination: LocationInput;
  parcels: Parcel[];
  totalWeightGrams: number;
  declaredValue?: Money;
  metadata?: Record<string, unknown>;
}
