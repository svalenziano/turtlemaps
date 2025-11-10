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

type DefaultLayer = {
  name: string;
  color_fill: string | null;
  color_line: string | null;
  stroke_weight: number;
  tags: {
    [key: string]: string[] | null;
  }
}

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

type validBbox = {
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

type unknownBbox = Record<keyof validBbox, number | null>

// CLASSES
class BBox implements unknownBbox {
  /*
  Cordinates and bounding boxes are confusing because they are formatted
  differently by different organizations.  For example, OSM Overpass and 
  Nominatum define bbox differently!

  OSM Overpass: left, bottom, right, top
  Nominatum:    bottom, top, left, right

  This class aims to make things a little less ambiguous.

  More info: https://wiki.openstreetmap.org/wiki/Bounding_box
  */

  // Current values
  bottom: number | null = null;
  left: number | null = null;
  top: number | null = null;
  right: number | null = null;

  // Original values
  oBottom: number | null = null;
  oLeft: number | null = null;
  oTop: number | null = null;
  oRight: number | null = null;
  oWidth: number | null = null;
  oHeight: number | null = null;

  constructor() {}

  parseLatitudeFirst(bbox: [minLat, minLon, maxLat, maxLon]): void {
    // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
    [this.bottom, this.left, this.top, this.right] = bbox;
    [this.oBottom, this.oLeft, this.oTop, this.oRight] = bbox;
    this.oWidth = this.width;
    this.oHeight = this.height;
  }

  /*
  Crop or re-crop the original bbox to match the SVG aspect ratio
  */
  crop(svgWidth: number, svgHeight: number): void {
    if (this.isValid()) {
      // Map bbox width to svg width in order to test height
      let testHeight = this.oWidth * svgHeight / svgWidth;
      // If box is wider than it is tall
      if (testHeight < svgHeight) {
        // Get the width that matches the svg aspect ratio
        const newBboxWidth = this.oHeight * svgWidth / svgHeight;
        // Crop the left and right from the box
        const center = (this.oLeft + this.oRight) / 2;
        this.left = center - (newBboxWidth / 2);
        this.right = center + (newBboxWidth / 2);
      } else {
        // Get the height that matches the svg aspect ratio
        const newBboxHeight = this.oWidth * svgHeight / svgWidth;
        // Crop top and bottom from the box
        const center = (this.oBottom + this.oTop) / 2;
        this.bottom = center - (newBboxHeight / 2);
        this.top = center + (newBboxHeight / 2);
      }
    }
  }

  isValid(): this is validBbox {
    return (
      typeof this.bottom === "number" &&
      typeof this.left === "number" &&
      typeof this.top === "number" &&
      typeof this.right === "number" &&
      typeof this.oBottom === "number" &&
      typeof this.oLeft === "number" &&
      typeof this.oTop === "number" &&
      typeof this.oRight === "number" &&
      typeof this.oWidth === "number" &&
      typeof this.oHeight === "number"
    )
  }



  // TODO: NOT WORKING, DO NOT USE
  // Positive numbers are required for width and height
  // "Values for width or height lower or equal to 0 disable rendering of the element."
  // https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
  get svgViewBox(): string {
    return [this.left, this.bottom, this.width, this.height].join(" ");
  }

  get width() {
    if (this.left !== null && this.right !== null) {
      return Math.abs(this.right - this.left);
    } else {
      throw new Error("Not initialized")
    }
  }

  get height() {
    if (this.top !== null && this.bottom !== null) {
      return Math.abs(this.top - this.bottom)
    } else {
      throw new Error("Not initialized")
    }
  }
}

function makeSVGElement(type: "svg" | "rect" | "circle" | "polygon" | "path" | "g"): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", type);
}

function makeSVGPath(points: Point[], maxOpen=0.01): SVGPathElement {
  /*
  maxOpen = if start and end points are separated by a minimum of this distance
    the shape will not be filled
  */
  const path = makeSVGElement("path") as SVGPathElement;

  if (points.length < 2) {
    throw new Error("At least 2 points are required")
  }

  let commands: string[] = [`M ${points[0][0]},${points[0][1]}`];

  for (let i = 1; i < points.length; i++) {
    commands.push(`L ${points[i][0]},${points[i][1]}`);
  }
  // console.log(commands)
  path.setAttribute("d", commands.join(" "));

  const lastPoint = points[points.length - 1]

  if (U.dist(points[0][0], points[0][1], lastPoint[0], lastPoint[1])) {
    path.setAttribute("fill", "none");
  }
  
  return path;
}

// Utility functions
class U {

  // Based on p5js implementation https://github.com/processing/p5.js/blob/44341795ec65d956b9efe3290da478519dcf01bd/src/math/calculation.js#L605
  static map(val: number, start1:number, stop1:number, start2:number, stop2:number, withinBounds:boolean=false) {
    const newval = (val - start1) / (stop1 - start1) * (stop2 - start2) + start2;
    if (!withinBounds) {
      return newval;
    }
    if (start2 < stop2) {
      return this.constrain(newval, start2, stop2);
    } else {
      return this.constrain(newval, stop2, start2);
    }
  };

  static constrain(val:number, min:number, max:number) {
    if (min >= max) throw new Error("Min should be less than max");
    if (val <= min) return min;
    if (val >= max) return max;
    else return val;
  }

  static dist(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  static saveSVG(svg: SVGElement): void {
    if (!svg) {
      const s = document.querySelector("svg");
      if (!s) throw new Error("SVG was not provided");
      svg = s;
    }
    
    let data = (new XMLSerializer()).serializeToString(svg);
    let svgBlob = new Blob([data], {type: "image/svg+xml;charset=utf-8"});
    let url = URL.createObjectURL(svgBlob);
    triggerDownload(url)

    
    function triggerDownload(imgURI: string, filename="image.svg") {
    let a = document.createElement('a');

    a.setAttribute('download', filename);
    a.setAttribute('href', imgURI);
    a.setAttribute('target', '_blank');

    a.click();
}

  }
}

class Colors {
  static default = {
    bg: "rgb(241, 244, 203)",
    light: "rgba(255, 255, 255, 1)",
    dark: "rgb(65, 54, 51)",
    bright: "rgba(238, 86, 66, 1)",
    green: "rgba(153, 197, 114, 1)",
    blue: "rgba(138, 181, 204, 1)",
    ick: "rgba(115, 28, 122, 1)",
  }
}

class Layer {

  
  static strokesWeights = {
      faint: 0.3,
      light: 0.5,
      medium: 1.3,
      heavy: 2.5,
      super: 4,
    }

  // Top layers are drawn last
  static defaultLayers: DefaultLayer[] = [
    { 
      name: "Buildings - Residential",
      color_fill: Colors.default.bright,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.faint,
      tags: {
        building: ["house", "residential", "detached", "apartments", "semidetached_house", "bungalow", "dormitory"],
      },
    },
    { 
      name: "Buildings - All",
      color_fill: Colors.default.dark,
      color_line: Colors.default.bright,
      stroke_weight: this.strokesWeights.faint,
      tags: {
        building: null,
      },
    },
    {
      name: "Paths",
      color_fill: Colors.default.bg,
      color_line: Colors.default.dark, 
      stroke_weight: this.strokesWeights.faint,
      tags: {
        highway: ["footway", "service", "driveway", "path", "pedestrian"],
      },
    },
    {
      name: "Primary Roads",
      color_fill: null,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.super,
      tags: {
        highway: ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", ]
      },
    },
    {
      name: "Secondary Roads",
      color_fill: null,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.heavy,
      tags: {
        highway: ["secondary", "secondary_link", "tertiary", "tertiary_link",]
      },
    },
    {
      name: "Tertiary Roads",
      color_fill: null,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.medium,
      tags: {
        highway: ["residential", "service"]
      },
    },
    {
      name: "Paths",
      color_fill: null,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.light,
      tags: {
        highway: ["footway", "service", "driveway"]
      },
    },
    {
      name: "Water",
      color_fill: Colors.default.blue,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.faint,
      tags: {
        waterway: null,
        natural: ["water"],
      },
    },
    {
      name: "Green Space",
      color_fill: Colors.default.green,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.faint,
      tags: {
        leisure: ["park", "garden"],
        landuse: ["grass"],
      },
    },
    {
      name: "Public Space",
      color_fill: Colors.default.green,
      color_line: Colors.default.dark,
      stroke_weight: this.strokesWeights.faint,
      tags: {
        leisure: ["village_green", "track", "dog_park"],
        amenity: ["school"],
      }
    },
    {
      name: "Parking",
      color_fill: Colors.default.ick,
      color_line: Colors.default.bg,
      stroke_weight: this.strokesWeights.faint,
      tags: {
        parking: null,
        parking_space: null,
        amenity: ["parking"],
        building: ["parking", "parking_garage", "parking_shelter", "car_park", "parkingbuilding", "parking_deck"]
      }
    },
    {
      name: "No Tresspassing",
      color_fill: Colors.default.bright,
      color_line: null,
      stroke_weight: this.strokesWeights.faint,
      tags: {
        access: ["private"],
      },
    },
  ];
}

class MapApp {
  bbox: BBox;
  query: string | null;
  centroid: [number, number] | null;
  $svg: SVGElement;
  svgWidth: number = window.innerWidth;
  svgHeight: number = window.innerWidth;

  constructor(public container: HTMLElement) {
    this.bbox = new BBox();
    this.query = null;
    this.centroid = null;

    this.$svg = makeSVGElement("svg");
    this.container.append(this.$svg);
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
    const svg = this.$svg;
    svg.setAttribute("width", String(this.svgWidth));
    svg.setAttribute("height", String(this.svgHeight));
    svg.setAttribute("viewBox", `0 0 ${this.svgWidth} ${this.svgHeight}`);
  
    // this.bbox.crop(this.svgWidth, this.svgHeight);

    let rect = makeSVGElement("rect");
    rect.setAttribute("x", String(0));
    rect.setAttribute("y", String(0));
    rect.setAttribute("width", String(this.svgWidth));
    rect.setAttribute("height", String(this.svgHeight));
    rect.setAttribute("fill", "rgba(153, 6, 167, 1)");
    svg.append(rect)

    let g = makeSVGElement("g") as SVGGElement;
    // g.setAttribute("transform", "scale(1, -1)");
    g.setAttribute("stroke", "white");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke-width", "3");
    svg.append(g);

    // Diagonal top left to bottom right
    // let path = makeSVGPath([[this.bbox.minLon, this.bbox.maxLat], [this.bbox.maxLon, this.bbox.minLat]]);
    // let path = makeSVGPath([[0, 0], [this.svgWidth, this.svgHeight]]);
    // g.append(path);

    // test the cropBox
    // if (this.bbox.isValid()) {
    //   rect = makeSVGElement("rect");
    //   rect.setAttribute("x", String(U.map(this.bbox.left, this.bbox.left, this.bbox.right, 0, this.svgWidth)));
    //   rect.setAttribute("y", String(U.map(this.bbox.top, this.bbox.top, this.bbox.bottom, 0, this.svgHeight)));
    //   rect.setAttribute("width", String(this.svgWidth));
    //   rect.setAttribute("height", String(this.svgHeight));
    //   rect.setAttribute("stroke", "blue");
    //   rect.setAttribute("fill", "none");
    //   rect.setAttribute("stroke-width", "6");
    //   svg.append(rect);
    // } else {
    //   throw new Error("uh oh")
    // }
    
    g = makeSVGElement("g") as SVGGElement;
    // g.setAttribute("transform", "scale(1, -1)");
    g.setAttribute("stroke", "rgba(80, 0, 0, 1)");
    g.setAttribute("fill", "rgba(255, 82, 241, 0.27)");
    g.setAttribute("stroke-width", "0.5");
    svg.append(g);

    // debugger;
    for (let ele of elements) {
      if (ele.type !== "way") continue;

      const mappedPoints: Point[] = ele.geometry.map((point) => {
        return this.mapOSMPoint(point);
      }).map(OSMPoint => [OSMPoint.lon, OSMPoint.lat]);

      const shape = makeSVGPath(mappedPoints)

      g.append(shape);
    }

    document.body.append(svg);
  }




  mapOSMPoint(pt: OSMPoint, precision=3): OSMPoint {
    if (!this.bbox.isValid()) throw new Error("Only works with valid bbox");
    return {
      lat: Number(U.map(pt.lat, this.bbox.top, this.bbox.bottom, 0, this.svgHeight).toFixed(precision)),
      lon: Number(U.map(pt.lon, this.bbox.left, this.bbox.right, 0, this.svgWidth).toFixed(precision))
    }

  }


  mapPoint(pt: Point): Point {
  if (!this.bbox.isValid()) throw new Error("Only works with valid bbox")
  return [
    U.map(pt[0], this.bbox.left, this.bbox.right, 0, this.svgWidth),
    U.map(pt[1], this.bbox.top, this.bbox.bottom, 0, this.svgHeight)
  ];
  }
}

class svgMap {

}

/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// MAIN LOOP

document.addEventListener("DOMContentLoaded", () => {
  const $container = document.querySelector("section.app") as HTMLElement;
  if (!$container) throw new Error("Container not found")

  const app = new MapApp($container);
  app.init();
})