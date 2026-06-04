export interface GooglePlaceInput {
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  formatted_address?: string;
  geometry?: {
    location?:
      | {
          lat: number;
          lng: number;
        }
      | {
          lat: () => number;
          lng: () => number;
        };
  };
  place_id?: string;
  types?: string[];
}

export interface NormalizedGooglePlace {
  countryCode: string | null;
  postalCode: string | null;
  level1: string | null;
  level2: string | null;
  level3: string | null;
  level4: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  source: {
    provider: "google";
    placeId: string | null;
    types: string[];
  };
}
