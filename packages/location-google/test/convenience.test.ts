import { describe, expect, it } from "vitest";
import { googlePlaceToLocationInput } from "../src/convenience.js";

describe("googlePlaceToLocationInput", () => {
  it("composes normalize + project with default hierarchy mode", () => {
    const place = {
      address_components: [
        { long_name: "Jelambar", short_name: "Jelambar", types: ["administrative_area_level_4"] },
        { long_name: "Jakarta Barat", short_name: "Jakarta Barat", types: ["administrative_area_level_2"] },
        { long_name: "DKI Jakarta", short_name: "JK", types: ["administrative_area_level_1"] },
        { long_name: "Indonesia", short_name: "ID", types: ["country"] },
        { long_name: "11460", short_name: "11460", types: ["postal_code"] },
      ],
    };

    const result = googlePlaceToLocationInput(place);

    expect(result.method).toBe("location");
    expect(result.countryCode).toBe("ID");
    expect(result.level2).toBe("Jakarta Barat");
    expect(result).not.toHaveProperty("postalCode");
  });

  it("passes resultType through to projection", () => {
    const place = {
      address_components: [
        { long_name: "Indonesia", short_name: "ID", types: ["country"] },
        { long_name: "11460", short_name: "11460", types: ["postal_code"] },
      ],
    };

    const result = googlePlaceToLocationInput(place, { resultType: "postalCode" });

    expect(result.postalCode).toBe("11460");
    expect(result).not.toHaveProperty("level1");
  });
});
