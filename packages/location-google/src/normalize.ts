import type { GooglePlaceInput, NormalizedGooglePlace } from "./types.js";

function findComponent(
  place: GooglePlaceInput,
  ...types: string[]
): { long_name: string; short_name: string } | undefined {
  for (const type of types) {
    const component = place.address_components?.find((c) => c.types.includes(type));
    if (component) {
      return component;
    }
  }
  return undefined;
}

type LatLngLike = NonNullable<GooglePlaceInput["geometry"]>["location"];

function extractLatLng(location: LatLngLike): {
  latitude: number | null;
  longitude: number | null;
} {
  if (!location) {
    return { latitude: null, longitude: null };
  }

  if (typeof location.lat === "function" && typeof location.lng === "function") {
    return {
      latitude: location.lat(),
      longitude: location.lng(),
    };
  }

  if (typeof location.lat === "number" && typeof location.lng === "number") {
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  }

  return { latitude: null, longitude: null };
}

export function normalizeGooglePlace(place: GooglePlaceInput): NormalizedGooglePlace {
  const country = findComponent(place, "country");
  const postalCode = findComponent(place, "postal_code");

  const level1 = findComponent(place, "administrative_area_level_1");
  const level2 = findComponent(place, "administrative_area_level_2");
  const level3 = findComponent(place, "administrative_area_level_3");
  const level4 = findComponent(place, "administrative_area_level_4");

  // Fallbacks for missing hierarchy levels
  const locality = findComponent(place, "locality");
  const sublocality1 = findComponent(place, "sublocality_level_1");
  const sublocality = findComponent(place, "sublocality");

  const resolvedLevel3 = level3 ?? locality;
  const resolvedLevel4 = level4 ?? sublocality1 ?? sublocality;

  const { latitude, longitude } = extractLatLng(place.geometry?.location);

  return {
    countryCode: country?.short_name?.toUpperCase() ?? null,
    postalCode: postalCode?.long_name ?? null,
    level1: level1?.long_name ?? null,
    level2: level2?.long_name ?? null,
    level3: resolvedLevel3?.long_name ?? null,
    level4: resolvedLevel4?.long_name ?? null,
    latitude,
    longitude,
    formattedAddress: place.formatted_address ?? null,
    source: {
      provider: "google",
      placeId: place.place_id ?? null,
      types: place.types ?? [],
    },
  };
}
