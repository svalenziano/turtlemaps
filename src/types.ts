///////////////////////////////////////////////////////////
// Misc



/////////////////////////////////////////////////////////////////////////////
// Geometric Types

// For disambuigating coordinates
export type minLat = number;
export type minLon = number;
export type maxLat = number;
export type maxLon = number;

export type x = number;
export type y = number;

export type bboxArray = [minLat, minLon, maxLat, maxLon];

export type Point = [x, y];

export type GenericObject = {[key: string]: string};

export type DefaultLayer = {
  name: string;
  colorFill: string | null;
  colorStroke: string | null;
  strokeWeight: number;
  tags: {
    [key: string]: string[] | null;
  }
}

export type PointTransformer = (p: Point) => Point;


/////////////////////////////////////////////////////////////////////////////
// OSM Types

export enum OSMElementType {
  Node = "node",
  Way = "way",
  Relation = "relation"
}

export interface OSMBbox {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}

export interface OSMPoint {
  lat: number;
  lon: number;
}

export type UnknownOSMPointArray = OSMPoint[] | OSMPoint[][];

///////////////////////////////////////////////////////////
// OSM Elements
export interface OSMElementCommon {
  type: OSMElementType;
  id: number;
  bounds: OSMBbox;
  nodes?: number[];
  tags: GenericObject;
}

export interface OSMNode extends OSMElementCommon {
  type: OSMElementType.Node;
};         

export interface OSMRelation extends OSMElementCommon {
  type: OSMElementType.Relation;
  members: OSMElement[];
};        

export interface OSMWay extends OSMElementCommon {
  type: OSMElementType.Way;
  geometry: OSMPoint[];
  role?: "outer" | "inner";
  ref?: number;
}

export type OSMElement = OSMWay | OSMNode | OSMRelation;

///////////////////////////////////////////////////////////
// Other OSM

// https://wiki.openstreetmap.org/wiki/OSM_JSON
export interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OSMElement[];
}

export interface LocalOverpassAPI extends OverpassResponse {
  bbox: bboxArray;
  centroid: Point;
}

// export enum OSMZoomLevels {
//   "00 Whole World" = 0,  // do comments show up?
//   "01" = 1,
//   "02 Subcontinental Area" = 2,
//   "17 Block, Park, Addresses" = 17,
// }

/**
 * 
 */
type Range<N extends number, Result extends Array<unknown> = []> =
  Result['length'] extends N
    ? never
    : Result['length'] | Range<N, [unknown, ...Result]>;

/**
 * https://wiki.openstreetmap.org/wiki/Zoom_levels
| Level | Examples of  <br>areas to represent |
| ----- | ----------------------------------- |
| 0     | whole world                         |
| 2     | subcontinental area                 |
| 3     | largest country                     |
| 5     | large African country               |
| 6     | large European country              |
| 7     | small country, US state             |
| 9     | wide area, large metropolitan area  |
| 10    | metropolitan area                   |
| 11    | city                                |
| 12    | town, or city district              |
| 13    | village, or suburb                  |
| 15    | small road                          |
| 16    | street                              |
| 17    | block, park, addresses              |
| 18    | some buildings, trees               |
| 19    | local highway and crossing details  |
| 20    | A mid-sized building                |
 */
export type OSMZoomLevels = Range<20>; // 1 | 2 | ... | 20



/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////

export type validBbox = {
  bottom: number;
  left: number;
  top: number;
  right: number;
  oBottom: number;
  oLeft: number;
  oTop: number;
  oRight: number;
  oWidth: number;
  oHeight: number;
}

export type unknownBbox = Record<keyof validBbox, number | null>