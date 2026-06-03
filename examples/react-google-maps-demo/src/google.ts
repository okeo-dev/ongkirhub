import type { LocationMethodInput } from "@ongkirhub/client";

declare global {
  interface Window {
    google?: typeof google;
  }
}

let loadPromise: Promise<typeof google> | null = null;
let lastKey: string | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (window.google && lastKey === apiKey) return Promise.resolve(window.google);

  // If key changed, clear any stale state so retry works
  if (lastKey !== apiKey) {
    loadPromise = null;
    lastKey = apiKey;
  }

  if (loadPromise) return loadPromise;

  // Remove any previously injected Google script so the new key takes effect
  const existing = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existing) existing.remove();

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&language=id&region=ID`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) resolve(window.google);
      else {
        loadPromise = null;
        reject(new Error("Google Maps script loaded but window.google is missing"));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export interface NormalizedPlace {
  rawLabel: string;
  location: LocationMethodInput;
}

function stripPrefix(value: string, prefixes: string[]): string {
  const trimmed = value.trim();
  for (const prefix of prefixes) {
    const p = prefix + " ";
    if (trimmed.toLowerCase().startsWith(p.toLowerCase())) {
      return trimmed.slice(p.length).trim();
    }
  }
  return trimmed;
}

export function normalizePlace(place: google.maps.places.PlaceResult): NormalizedPlace {
  const comps = place.address_components ?? [];

  const get = (...types: string[]) => {
    const c = comps.find((x) => x.types.some((t) => types.includes(t)));
    return c?.long_name?.trim() ?? "";
  };

  const getShort = (...types: string[]) => {
    const c = comps.find((x) => x.types.some((t) => types.includes(t)));
    return c?.short_name?.trim() ?? "";
  };

  const countryCode = getShort("country");

  // Indonesia-specific normalization
  const level1 = stripPrefix(get("administrative_area_level_1"), ["Provinsi"]);
  const level2 = stripPrefix(get("administrative_area_level_2"), ["Kota", "Kabupaten"]);
  const level3 = stripPrefix(get("administrative_area_level_3"), ["Kecamatan"]);
  const level4 = stripPrefix(get("administrative_area_level_4"), ["Kelurahan", "Desa"]);

  const location: LocationMethodInput = {
    method: "location",
    countryCode: countryCode.toUpperCase(),
  };

  if (level1) location.level1 = level1;
  if (level2) location.level2 = level2;
  if (level3) location.level3 = level3;
  if (level4) location.level4 = level4;

  return {
    rawLabel: place.formatted_address ?? place.name ?? "Unknown",
    location,
  };
}

export function attachAutocomplete(
  input: HTMLInputElement,
  google: typeof window.google,
  onSelect: (normalized: NormalizedPlace) => void,
): google.maps.places.Autocomplete {
  const autocomplete = new google.maps.places.Autocomplete(input, {
    fields: ["address_components", "formatted_address", "name"],
    componentRestrictions: { country: "id" },
  });

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place.address_components) return;
    onSelect(normalizePlace(place));
  });

  return autocomplete;
}
