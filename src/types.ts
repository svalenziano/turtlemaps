// For disambuigating coordinates
export type minLat = number;
export type minLon = number;
export type maxLat = number;
export type maxLon = number;



export type bboxArray = [number, number, number, number];

export type Point = [number, number];

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
  members: OSMElement;
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

export interface OSMResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OSMElement[];
  bbox?: bboxArray;
  centroid: Point;
}

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