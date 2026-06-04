import { describe, expect, it } from "vitest";
import { normalizeGooglePlace } from "../src/normalize.js";

function makeComponent(
  longName: string,
  shortName: string,
  types: string[],
) {
  return { long_name: longName, short_name: shortName, types };
}

describe("normalizeGooglePlace", () => {
  it("extracts all fields from a complete Indonesia place", () => {
    const place = {
      address_components: [
        makeComponent("Jelambar", "Jelambar", ["administrative_area_level_4"]),
        makeComponent("Grogol Petamburan", "Grogol Petamburan", ["administrative_area_level_3"]),
        makeComponent("Jakarta Barat", "Jakarta Barat", ["administrative_area_level_2"]),
        makeComponent("DKI Jakarta", "JK", ["administrative_area_level_1"]),
        makeComponent("Indonesia", "ID", ["country"]),
        makeComponent("11460", "11460", ["postal_code"]),
      ],
      formatted_address: "Jelambar, Grogol Petamburan, Jakarta Barat, DKI Jakarta 11460, Indonesia",
      geometry: {
        location: { lat: -6.162, lng: 106.789 },
      },
      place_id: "ChIJ12345",
      types: ["political", "sublocality", "sublocality_level_1"],
    };

    const result = normalizeGooglePlace(place);

    expect(result.countryCode).toBe("ID");
    expect(result.postalCode).toBe("11460");
    expect(result.level1).toBe("DKI Jakarta");
    expect(result.level2).toBe("Jakarta Barat");
    expect(result.level3).toBe("Grogol Petamburan");
    expect(result.level4).toBe("Jelambar");
    expect(result.latitude).toBe(-6.162);
    expect(result.longitude).toBe(106.789);
    expect(result.formattedAddress).toBe(place.formatted_address);
    expect(result.source).toEqual({
      provider: "google",
      placeId: "ChIJ12345",
      types: ["political", "sublocality", "sublocality_level_1"],
    });
  });

  it("extracts fields from a US place", () => {
    const place = {
      address_components: [
        makeComponent("1600", "1600", ["street_number"]),
        makeComponent("Pennsylvania Avenue NW", "Pennsylvania Ave NW", ["route"]),
        makeComponent("Washington", "Washington", ["locality", "political"]),
        makeComponent("District of Columbia", "DC", ["administrative_area_level_1"]),
        makeComponent("United States", "US", ["country"]),
        makeComponent("20500", "20500", ["postal_code"]),
      ],
      formatted_address: "1600 Pennsylvania Avenue NW, Washington, DC 20500, USA",
      geometry: {
        location: { lat: 38.898, lng: -77.037 },
      },
      place_id: "ChIJGVtI4by3t4kRr51d_Qm_x58",
      types: ["street_address"],
    };

    const result = normalizeGooglePlace(place);

    expect(result.countryCode).toBe("US");
    expect(result.postalCode).toBe("20500");
    expect(result.level1).toBe("District of Columbia");
    expect(result.level2).toBeNull();
    expect(result.level3).toBe("Washington"); // locality fallback
    expect(result.level4).toBeNull();
    expect(result.latitude).toBe(38.898);
    expect(result.longitude).toBe(-77.037);
  });

  it("falls back sublocality_level_1 to level4 when administrative_area_level_4 is missing", () => {
    const place = {
      address_components: [
        makeComponent("Kemang", "Kemang", ["sublocality_level_1"]),
        makeComponent("Mampang Prapatan", "Mampang Prapatan", ["administrative_area_level_3"]),
        makeComponent("Jakarta Selatan", "Jakarta Selatan", ["administrative_area_level_2"]),
        makeComponent("DKI Jakarta", "JK", ["administrative_area_level_1"]),
        makeComponent("Indonesia", "ID", ["country"]),
      ],
      formatted_address: "Kemang, Jakarta Selatan, DKI Jakarta, Indonesia",
    };

    const result = normalizeGooglePlace(place);

    expect(result.level4).toBe("Kemang");
    expect(result.level3).toBe("Mampang Prapatan");
  });

  it("handles partial places with missing fields gracefully", () => {
    const place = {
      address_components: [
        makeComponent("Indonesia", "ID", ["country"]),
      ],
      formatted_address: "Indonesia",
    };

    const result = normalizeGooglePlace(place);

    expect(result.countryCode).toBe("ID");
    expect(result.postalCode).toBeNull();
    expect(result.level1).toBeNull();
    expect(result.level2).toBeNull();
    expect(result.level3).toBeNull();
    expect(result.level4).toBeNull();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });

  it("handles empty input gracefully", () => {
    const result = normalizeGooglePlace({});

    expect(result.countryCode).toBeNull();
    expect(result.postalCode).toBeNull();
    expect(result.level1).toBeNull();
    expect(result.level2).toBeNull();
    expect(result.level3).toBeNull();
    expect(result.level4).toBeNull();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.formattedAddress).toBeNull();
    expect(result.source.placeId).toBeNull();
    expect(result.source.types).toEqual([]);
  });

  it("extracts coordinates from real Google-style LatLng with lat()/lng() methods", () => {
    const place = {
      address_components: [
        makeComponent("Jelambar", "Jelambar", ["administrative_area_level_4"]),
        makeComponent("Jakarta Barat", "Jakarta Barat", ["administrative_area_level_2"]),
        makeComponent("DKI Jakarta", "JK", ["administrative_area_level_1"]),
        makeComponent("Indonesia", "ID", ["country"]),
      ],
      geometry: {
        location: {
          lat: () => -6.162,
          lng: () => 106.789,
        },
      },
    };

    const result = normalizeGooglePlace(place);

    expect(result.latitude).toBe(-6.162);
    expect(result.longitude).toBe(106.789);
  });
});
