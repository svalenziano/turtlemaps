import * as T from "./types.js"


///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A simple interface for working with the OSM Overpass API
 */
export class OSM {

  constructor(
    public fetcher: typeof fetch, 
    public api=OSM.PATHS["overpass.de"]
    ) {}


  static PATHS = {
    "overpass.de": "https://overpass-api.de/api/interpreter"
  }

  async fetchlayers(layerNames=[]) {
    /*
    Input: (optional) layers to fetch data for.  
      If none are provided, this.layers will be used
    Return: JSON response
    parse response and populate each layer with elements
    */

    
    let query = "";
    if (layerNames.length === 0) {
      for (const layer of this.layers) {
        query += layer.queryString;
      }

      const osmQuery = "data=" + encodeURIComponent(`
          [bbox:${this.coordString}][out:json][timeout:${TIMEOUT}];
          (${query});
          out geom;`);

      const response = await osmFetcher.fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: osmQuery,
      });

      const json = await response.json();
      console.log(`Fetched ${json.elements.length} elements`)
      return json;

    } else {
      throw new Error("NOT YET IMPLEMENTED")
    }
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