/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// TYPES

// For disambuigating coordinates
type minLat = number;
type minLon = number;
type maxLat = number;
type maxLon = number;

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
class BBox {
  /*
  Cordinates and bounding boxes are confusing because they are formatted
  differently by different organizations.

  This class aims to make things a little less ambiguous.
  */
  minLat: number | null = null;
  minLon: number | null = null;
  maxLat: number | null = null;
  maxLon: number | null = null;
  
  constructor() {}

  parseLatitudeFirst(bbox: [minLat, minLon, maxLat, maxLon]): void {
    // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
    this.minLat = bbox[0];
    this.minLon = bbox[1];
    this.maxLat = bbox[2];
    this.maxLon = bbox[3];
  }

  // Positive numbers are required for width and height
  // "Values for width or height lower or equal to 0 disable rendering of the element."
  // https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
  get svgViewBox(): string {
    return [this.minLon, this.minLat, this.width, this.height].join(" ");
  }

  get width() {
    if (this.minLon !== null && this.maxLon !== null) {
      return Math.abs(this.minLon - this.maxLon);
    } else {
      throw new Error("Not initialized")
    }
  }

  get height() {
    if (this.minLat !== null && this.maxLat !== null) {
      return Math.abs(this.minLat - this.maxLat)
    } else {
      throw new Error("Not initialized")
    }
  }
}

function makeSVGElement(type: "svg" | "rect" | "circle" | "polygon" | "path" | "g"): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", type);
}

function makeSVGPath(points: Point[]): SVGPathElement {
  const path = makeSVGElement("path") as SVGPathElement;

  if (points.length < 2) {
    throw new Error("At least 2 points are required")
  }

  let commands: string[] = [`M ${points[0][0]},${points[0][1]}`];

  for (let i = 1; i < points.length; i++) {
    commands.push(`L ${points[i][0]},${points[i][1]}`);
  }
  console.log(commands)
  path.setAttribute("d", commands.join(" "));
  
  return path;
}

class MapApp {
  data: object;  // TODO - import OSM types
  bbox: BBox;
  query: string | null;
  centroid: [number, number] | null;
  svgWidth: number = 300;
  svgHeight: number = 300;

  constructor() {
    this.data = {};
    this.bbox = new BBox();
    this.query = null;
    this.centroid = null;
  }

  async init() {
    const response = await fetch("./data/durham_nc.json");
    const json = await response.json() as OSMResponse;

    if (json.bbox) {
      this.bbox.parseLatitudeFirst(json.bbox);
    } else {
      throw new Error("no bbox was found");
    }

    this.centroid = json.centroid;

    const elements: OSMElement[] = json.elements;

    // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
    const svg = makeSVGElement("svg");
    svg.setAttribute("width", String(this.svgWidth));
    svg.setAttribute("height", String(this.svgHeight));
    svg.setAttribute("viewBox", this.bbox.svgViewBox);
  
    const rect = makeSVGElement("rect");
    rect.setAttribute("x", String(this.bbox.minLon));
    rect.setAttribute("y", String(this.bbox.minLat));
    rect.setAttribute("width", String(this.bbox.width));
    rect.setAttribute("height", String(this.bbox.height));
    rect.setAttribute("fill", "red");
    svg.append(rect)

    let g = makeSVGElement("g") as SVGGElement;
    // g.setAttribute("transform", "scale(1, -1)");
    g.setAttribute("stroke", "gray");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke-width", "0.001");
    svg.append(g);

    // Diagonal top left to bottom right
    // let path = makeSVGPath([[this.bbox.minLon, this.bbox.maxLat], [this.bbox.maxLon, this.bbox.minLat]]);
    let path = makeSVGPath([[this.bbox.minLon, this.bbox.minLat], [this.bbox.maxLon, this.bbox.maxLat]]);
    g.append(path);

    document.body.append(svg);
  }
}

class svgMap {

}

/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// MAIN LOOP

document.addEventListener("DOMContentLoaded", () => {

  const app = new MapApp();
  app.init();
})