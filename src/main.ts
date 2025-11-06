/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// TYPES
type bboxArray = [number, number, number, number];

type Point = [number, number];

type GenericObject = {[key: string]: string};

/////////////////////////////////////////////////////////////////////////////
// OSM Types

enum OSMElementType {
  Node = "node",
  Way = "way",
  Relation = "relation"
}

interface OSMBbox {
  minlat: number;
  minlon: number;
  maxlat: number;
  maxlon: number;
}

interface OSMPoint {
  lat: number;
  lon: number;
}

///////////////////////////////////////////////////////////
// OSM Elements
interface OSMElementCommon {
  type: OSMElementType;
  id: number;
  bounds: OSMBbox;
  nodes?: number[];
  tags: GenericObject;
}

interface OSMNode extends OSMElementCommon {
  type: OSMElementType.Node;
};         

interface OSMRelation extends OSMElementCommon {
  type: OSMElementType.Relation;
  members: OSMElement;
};        

interface OSMWay extends OSMElementCommon {
  type: OSMElementType.Way;
  geometry: OSMPoint[];
  role?: "outer" | "inner";
  ref?: number;
}

type OSMElement = OSMWay | OSMNode | OSMRelation;

///////////////////////////////////////////////////////////
// Other OSM

interface OSMResponse {
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
// CLASSES


function makeSVGElement(type: "svg" | "rect" | "circle" | "polygon" | "path" | "g"): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", type);
}

class MapApp {
  data: object;  // TODO - import OSM types
  bbox: bboxArray | null;
  query: string | null;
  centroid: [number, number] | null;

  constructor() {
    this.data = {};
    this.bbox = null;
    this.query = null;
    this.centroid = null;
  }

  async init() {
    const response = await fetch("./data/durham_nc.json");
    const json = await response.json();
    this.bbox = json.bbox;
    this.centroid = json.centroid;

    const elements: OSMElement[] = json.elements;
  }
}

class svgMap {

}

/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// MAIN LOOP

document.addEventListener("DOMContentLoaded", () => {
  const WIDTH = "300";
  const HEIGHT = "300";

  const svg = makeSVGElement("svg");
  svg.setAttribute("width", WIDTH);
  svg.setAttribute("height", HEIGHT);
  svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

  const rect = makeSVGElement("rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", WIDTH);
  rect.setAttribute("height", HEIGHT);
  rect.setAttribute("fill", "red");
  svg.append(rect)

  document.body.append(svg);
})