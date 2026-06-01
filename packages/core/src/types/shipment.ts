export interface Address {
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  addressLine?: string;
}

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
  origin: Address;
  destination: Address;
  parcels: Parcel[];
  totalWeightGrams: number;
  declaredValue?: Money;
  metadata?: Record<string, unknown>;
}
