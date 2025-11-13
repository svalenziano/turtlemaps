import * as T from "./types.js"
import { BBox } from "./bbox.js";
import { REFERER } from "./config.js";
import { Layer } from "./layer.js";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A simple interface for working with the 
 * [OSM Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
 */
export class Overpass {
  timeout: number;

/**
 * 
 * @param fetcher the native `fetch` function or a drop-in alternative
 */
  constructor(
    public fetcher: typeof fetch, 
    public api=Overpass.PATHS["overpass.de"]
    ) {
      this.timeout = 7000;
    }


  static PATHS = {
    "overpass.de": "https://overpass-api.de/api/interpreter"
  }

  async query(query: string, bbox: BBox): Promise<T.OverpassResponse> {

      const osmQuery = "data=" + encodeURIComponent(`
          [bbox:${bbox.overpassBbox}][out:json][timeout:${this.timeout}];
          (${query});
          out geom;`);

      const response = await fetch(this.api, {
        method: "POST",
        body: osmQuery,
        headers: {
          "Referer": REFERER,
        }
      });

      const json: T.OverpassResponse = await response.json();
      console.info(`Fetched ${json.elements.length} elements`)
      return json;
  }

/**
 A sample query:
 ```txt
  [bbox: ${DURHAM_COORDS}][out:json][timeout: 10];
  wr["building"];
  out geom;
 ```
 More info: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
 */
  formQueryFromLayers(layers: Layer[]): string {
    let layerQuery = "";
    for (let l of layers) {
      layerQuery += l.queryString;
    }
    return layerQuery;
  }

/**
 * Convert `{lat: 1.23, lon: 3.45}` to `[3.45, 1.23]`
 */
  static convertPoint(pt: T.OSMPoint): T.Point {
    return [pt.lon, pt.lat];
  }

  static extractRelationGeom(
    ele: T.OSMRelation, 
    filter: T.PointTransformer | null = null
    ): T.Point[][] {

    const result: T.Point[][] = [];
    for (let member of ele.members) {
      const memberPoints: T.Point[] = [];
      if (!(member.type === "way")) continue;

      for (let pt of member.geometry) {
        let mappedPoint: T.Point;
        if (filter) {
          mappedPoint = filter([pt.lon, pt.lat]);
        } else {
          mappedPoint = [pt.lon, pt.lat];
        }
        memberPoints.push(mappedPoint);
      }
      result.push(memberPoints);
    }
    return result;
  }
}