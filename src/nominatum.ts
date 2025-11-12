/**
 * A Nominatum GEOJson "feature".  WARNING: WIP! 🔴
 */
export type NominatumFeature = {
  type: string;
  properties: { [key: string]: string | number };
  bbox: [number, number, number, number];
  geometry?: unknown;
}

/**
 * A nominatum GeoJSON response.  WARNING: WIP! 🔴
 */
export type GeoJSON = {
  type: string;
  license: string;
  features: NominatumFeature[];
}


/**
 * A simple interface for the Nominatum API
 * 
 * @remarks
 * API providers: https://wiki.openstreetmap.org/wiki/Nominatim#Alternatives_.2F_Third-party_providers
 * Check the provider's usage policy before using their service!
 */

export class Nominatum {
  static PATHS = {
    'osmfoundation': "https://nominatim.openstreetmap.org/search?",  // Very limited throughput.  Do not use unless absolutely necessary
    "geocoding.ai": "https://nominatim.geocoding.ai/search?",  // geocoding.ai (defunct as of late 2025?)
  }

  // Choose your API provider
  static BASE_PATH = Nominatum.PATHS["osmfoundation"];
  
  static async freeForm(queryString: string): Promise<GeoJSON> {
    const params = ["q=" + encodeURIComponent(queryString)];
    params.push("format=geojson");  // required to obtain centroid

    const response = await fetch(Nominatum.BASE_PATH + params.join("&"), {
      headers: {
        "Referer": "https://www.stvn.us/pages/contact",
      }
    });

    const json: GeoJSON = await response.json();
    return json;
  }

  static getCentroid(json: GeoJSON) {
    /*
    Input: JSON response from Nominatum API
    Return: coordinates of first location as array, eg [lat, long] / [1.23, 4.56]
    */
    if (!json.features) {
      console.error("Features not found.  Here's the response:");
      console.error(json);
      return;
    }
    
    // Expect geo to be { type: "Point", coordinates: [1.23, 4,56] }
    const geo = json.features[0]?.geometry as {type: "Point", coordinates: [number, number]};

    if (typeof geo === "object" && geo.type === "Point" && Array.isArray(geo.coordinates)) {
      const [long, lat] = geo.coordinates;
      return [lat, long];
    } else {
      throw new Error("API response was unexpected")
    }


  }
}