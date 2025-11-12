import * as T from "./types.js"


///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * A simple interface for working with the OSM Overpass API
 */
export class OSM {

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