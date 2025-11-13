import * as T from "./types.js"
import { SlowFetcher } from "./slow-fetcher.js"
import { Nominatum } from "./nominatum.js";
import { BBox } from "./bbox.js";
import { Overpass } from "./osm.js";
import { Layer } from "./layer.js";
import { Color } from "./color.js";
import { SVG } from "./SVG.js";

export {};  // ensure this file is treated as a module

// CLASSES



/**
 * Misc. utility functions
 */
export class U {
  
  static slugify(str: string) {
    // Credit: https://byby.dev/js-slugify-string
    return String(str)
      .normalize('NFKD') // split accented characters into their base characters and diacritical marks
      .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
      .trim() // trim leading or trailing whitespace
      .toLowerCase() // convert to lowercase
      .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
      .replace(/\s+/g, '-') // replace spaces with hyphens
      .replace(/-+/g, '-'); // remove consecutive hyphens
  }

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

/**
 * Intent: use when data from an API is not formed as you expect
 */
export class DataError extends Error {
  date: Date;

  constructor(msg: string) {
    super(msg);

    Object.setPrototypeOf(this, DataError.prototype);

    this.name = "DataError";
    this.date = new Date();

  }
}

class MapApp {
  bbox: BBox;
  query: string | null;
  centroid: [number, number] | null;
  svg: SVG;
  layers: Layer[];
  nom: Nominatum;
  osm: Overpass;

  constructor(public container: HTMLElement) {
    this.bbox = new BBox();
    this.query = null;
    this.centroid = null;
    this.svg = new SVG(document.body, window.innerWidth, window.innerWidth);
    
    // const osmFetcher = new SlowFetcher(1000);
    this.osm = new Overpass(fetch);
    
    // const nominatimFetcher = new SlowFetcher(1000);
    this.nom = new Nominatum(fetch);

    this.layers = Layer.makeDefaultLayers();
    this.layers.forEach((l) => this.svg.$svg.append(l.$g));
  }

  static DEFAULT_ZOOM = 17 as const; // https://wiki.openstreetmap.org/wiki/Zoom_levels

/**
 * Side effects: reassigns this.bbox to a new bbox
 */
  async jump(query: string, zoom: T.OSMZoomLevels = MapApp.DEFAULT_ZOOM) {
    debugger;
    const loc = await this.nom.resolveCoordinates(query, zoom);
    this.bbox = new BBox(loc.bbox);
    const overpassQuery = this.osm.formQueryFromLayers(this.layers);
    const json = await this.osm.query(overpassQuery, this.bbox);
    this.drawOSM(json);
  }

/**
 * Fetch locally cached OSM data which has been appended with a bbox and centroid.
 * Side effects: updates app state based on response
 *
 * @returns response JSON
 */
  async fetchLocalOSM(query: string): Promise<T.LocalOverpassAPI> {
    try {
      const response = await fetch(query);
      const json = await response.json() as T.LocalOverpassAPI;

      if (json.bbox) {
        this.bbox.parseLatitudeFirst(json.bbox);
      } else {
        throw new DataError("no bbox was found");
      }

      this.centroid = json.centroid;
      return json;

    } catch (er) {
      if (er instanceof DataError) throw (er);
      else throw new Error(`Fetch for "${query}" failed.`);
      }
    }

/**
  * Side Effects: updates layers using data from OSM response
  * @todo see TODO below
  */
  drawOSM(json: T.OverpassResponse): void {
    const pointTransformer = this.mapPointToSVG.bind(this);
    // Parse response
    const elements: T.OSMElement[] = json.elements;
    // Decide which layer each element belongs to
    for (let ele of elements) {

      if ((ele.type === "node")) continue;  

      const layer = this.getLayer(ele);
      if (!(layer instanceof Layer)) {
        console.warn("Layer not found for", ele);
        continue;
      } 

      if (ele.type === "way") {
        const geom: T.Point[] = ele.geometry
          .map(p => Overpass.convertPoint(p))
          .map(this.mapPointToSVG, this)
        layer.addGeometry(SVG.makePath(geom));
      } else if (ele.type === "relation") {
        const geom: T.Point[][] = Overpass.extractRelationGeom(ele, pointTransformer)
        const path = SVG.makePath(geom);
        path.setAttribute("stroke", Color.default.hilite)
        layer.addGeometry(path);
      } else {
        const x: never = ele;  // TS exhaustiveness check
      }
      
    }
    // 
  }

  getLayer(ele: T.OSMElement) {
    const tags = ele.tags;
    for (let layer of this.layers) {
      if (layer.matchesTags(tags)) {
        return layer;
      }
    }
    return ele;
  }

/**
 * Re-map OSM point coordinates from `bbox` coordinate system to svg coord. sys.
 */
  mapOSMPointToSVG(pt: T.OSMPoint, precision=3): T.OSMPoint {
    if (!this.bbox.isValid()) throw new Error("Only works with valid bbox");
    return {
      lat: Number(U.map(pt.lat, this.bbox.top, this.bbox.bottom, 0, this.svg.height).toFixed(precision)),
      lon: Number(U.map(pt.lon, this.bbox.left, this.bbox.right, 0, this.svg.width).toFixed(precision))
    }

  }

/**
 * Remap a standard point `[x, y]` to SVG coord. sys.
 */
  mapPointToSVG(pt: T.Point): T.Point {
  if (!this.bbox.isValid()) throw new Error("Only works with valid bbox")
  return [
    U.map(pt[0], this.bbox.left, this.bbox.right, 0, this.svg.width),
    U.map(pt[1], this.bbox.top, this.bbox.bottom, 0, this.svg.height)
  ];
  }
}


/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// MAIN LOOP

document.addEventListener("DOMContentLoaded", async () => {
  const $container = document.querySelector("section.app") as HTMLElement;
  if (!$container) throw new Error("Container not found")

  // debugger;
  const app = new MapApp($container);
  const loc = await app.nom.resolveCoordinates("35.996653, -78.9018053");
  console.log(loc)
  const overpassQuery = app.osm.formQueryFromLayers(app.layers);
  console.log(overpassQuery);
  // const json = await app.osm.query(overpassQuery, app.bbox);

  // await app.jump("Durham, NC, USA");
  // const json = await app.fetchLocalOSM("./data/durham_nc.json");
  // console.log(json);
  // console.log(app.bbox);
  // app.drawOSM(json);
  // app.test();

  // const layers = Layer.makeDefaultLayers();
  // console.log(layers);
  // console.log("Setup is done")

  // NOM TESTING
  // const response = await Nominatum.freeForm("Durham, NC");
  // console.log(response);
  // console.log(Nominatum.getCentroid(response))
});
