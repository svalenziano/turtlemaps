import * as T from "./types.js"
import { BBox } from "./bbox.js";
import { REFERER, MAP_TIMEOUT_MILLIS } from "./config.js";
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
      this.timeout = MAP_TIMEOUT_MILLIS / 1000;  // unit = seconds
    }


  static PATHS = {
    "overpass.de": "https://overpass-api.de/api/interpreter"
  }

/**
 * The standard method for querying data from OSM Overpass
 */
  async queryLayers(layers: Layer[], bbox: BBox): Promise<T.OverpassJSONResponse> {
    const overpassQLQuery = this.formQueryFromLayers(layers, bbox);
    return await this.queryGeneric(overpassQLQuery);
  }

/**
 * **HELPER METHOD**
 *
 * Sends a generic Overpass QL query
 * @param query expects valid OSM Overpass QL string eg `"[bbox:35.9953,-78.9035,35.998,-78.9001][out:json][timeout:7]; (wr["building"];); out geom;""`
 * @returns JSON response
 */
  async queryGeneric(query: string): Promise<T.OverpassJSONResponse> {

      const response = await fetch(this.api, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "Referer": REFERER,
        }
      });

      const json: T.OverpassJSONResponse = await response.json();
      console.info(`Fetched ${json.elements.length} elements`)
      return json;
  }



/**
 * **HELPER METHOD**
 *
 * **Warning** output from this function is human readable and may need to be
 * encoded prior to sending to OSM
 *
 *
 * Sample return value:
 * ```txt
 *  [bbox: ${DURHAM_COORDS}][out:json][timeout: 10];
 *  wr["building"];
 *  out geom;
 * ```
 * More info: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
 *
 * @returns Human-readable query string
 */
  formQueryFromLayers(layers: Layer[], bbox: BBox): string {
    
    let layerQuery = "";
    for (let l of layers) {
      layerQuery += l.queryString;
    }
    
    const skeleton = `\
      [bbox:${bbox.overpassBbox}][out:json][timeout:${this.timeout}];
      (${layerQuery});
      out geom;`;
    
    return skeleton;
    
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