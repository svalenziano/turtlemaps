"use strict";

/*
Written by Steven Valenziano in 2025 to practice working with DOM manipulation, events, asynchronous programming, network requests (via fetch), with a sprinkling of pre-ES6 syntax just for giggles.

HEAVILY INSPIRED BY: Prettymaps, by Marcelo de Oliveira Rosa Prates (https://github.com/marceloprates/prettymaps)

Dependencies: p5js library

Intentionally left out:
 - p5 "draw" function.  All drawing happens at setup or is event-triggered

TODO / KNOWN LIMITATIONS:
  - Support for OSM multipolygons needs to be improved
*/

///////////////////////////////////////////////////////////
// TYPES
type bbox = [number, number, number, number];

type LayerOptions = { name: string; tags: {[k: string]: null | string[]}; color_line: string | null; color_fill: string | null }; //  Added by LLM Agent

// Ambient p5 function declarations to satisfy TypeScript (minimal set used in this file)
declare function stroke(col: any): void; //  Added by LLM Agent
declare function noStroke(): void; //  Added by LLM Agent
declare function fill(col?: any): void; //  Added by LLM Agent
declare function noFill(): void; //  Added by LLM Agent
declare function strokeWeight(w: number): void; //  Added by LLM Agent
declare function beginShape(): void; //  Added by LLM Agent
declare function endShape(): void; //  Added by LLM Agent
declare function beginContour(): void; //  Added by LLM Agent
declare function endContour(): void; //  Added by LLM Agent
declare function vertex(x: number, y: number): void; //  Added by LLM Agent
declare function point(x: number, y: number): void; //  Added by LLM Agent
declare function map(v: number, a: number, b: number, c: number, d: number): number; //  Added by LLM Agent
declare function createCanvas(w: number, h: number): void; //  Added by LLM Agent
declare function background(col: any): void; //  Added by LLM Agent
declare const width: number; //  Added by LLM Agent
declare const height: number; //  Added by LLM Agent

///////////////////////////////////////////////////////////
// CLASSES AND HELPER FUNCTIONS

type SlowFetchQueue = {
  url: string; 
  options: RequestInit;
  resolve: (value: Response) => void;  //  Added by LLM Agent
  reject: (reason?: any) => void;   //  Added by LLM Agent
}

// There are more robust methods of throttling, but this does the trick for now
class SlowFetcher {
  queue: Array<SlowFetchQueue>;
  milliseconds: number;
  timer: number | null;

  constructor(milliseconds: number) {
    this.queue = [];
    this.milliseconds = milliseconds;  // Minimum interval between requests.  unit = milliseconds
    this.timer = null;
  }

  async fetch(url: string, options: RequestInit): Promise<Response> { //  Added by LLM Agent
  let resolve: (value: Response) => void = () => { throw new Error('Uninitialized resolve'); }; //  Added by LLM Agent
  let reject: (reason?: any) => void = () => { throw new Error('Uninitialized reject'); }; //  Added by LLM Agent

    const futureFetch: Promise<Response> =  new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    
    // IF TIMER EXISTS, PUSH ARGUMENTS TO QUEUE FOR FUTURE FETCHING
    if (this.timer !== null) {
      this.queue.push({url, options, resolve, reject});
      console.log("SlowFetcher: Pushing new fetch to queue")
      console.log(this.queue)
      return futureFetch;

    // IF NO TIMER EXISTS, CREATE THE TIMER AND PROCESS THIS FETCH IMMEDIATELY
    } else {
      // CREATE TIMER that resolves the `futureFetch`
      console.log("SlowFetcher: Creating timer")
      this.timer = setInterval(async () => {
        if (this.queue.length > 0) {
          const item: SlowFetchQueue = this.queue.shift()!;
          const {url, options, resolve, reject} = item;
          const response = await fetch(url, options);
          if (typeof resolve !== "function" || typeof reject !== "function") {
            throw new Error("Unexpected type")
          }
          if (response.ok) {
            resolve(response);
          } else {
            reject(response);
          }
        } else {
          console.log("SlowFetcher: Destroying timer")
          if (typeof this.timer === "number") clearInterval(this.timer);
          this.timer = null;
        }
      }, this.milliseconds); 
      
      // PROCESS IMMEDIATELY and return Promise
      // no `await`, since we want this method to act exactly like the native `fetch`
      return fetch(url, options);  
    }
  }
}

class Util {
  /*
  Misc utilities 
  */

  static saveJSON(data: object, filename: string) {
    // Convert data to JSON string
    const jsonString = JSON.stringify(data, null, 2);
    
    // Create a Blob with the JSON data
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a link element
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static round(num: number, places: number) {
    /*
    Returns number
    */
    return Number(num.toFixed(places));
  }

  static toBbox([latitude, longitude]: number[], zoom: number) {
    /*
    Credit: LLM
    Zoom levels: https://wiki.openstreetmap.org/wiki/Zoom_levels
    tktk: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Implementations
    */
    const earthRadius = 6378137; // meters
    const earthCircumference = 2 * Math.PI * earthRadius;
    
    // Calculate the pixel size at the given zoom level
    const pixelsPerTile = 256;
    const metersPerPixel = earthCircumference / (pixelsPerTile * (2 ** zoom));
    
    // Convert meters to degrees (approximate)
    const metersPerDegreeLat = 111320; // meters per degree of latitude
    const metersPerDegreeLon = Math.abs(
        Math.cos(latitude * Math.PI / 180) * metersPerDegreeLat
    );
    
    // Calculate half-width and half-height of the bounding box
    const halfWidth = (pixelsPerTile / 2) * metersPerPixel / metersPerDegreeLon;
    const halfHeight = (pixelsPerTile / 2) * metersPerPixel / metersPerDegreeLat;
    
    // Calculate bounding box coordinates
    const minLon = Util.round(longitude - halfWidth, 4);
    const maxLon = Util.round(longitude + halfWidth, 4);
    const minLat = Util.round(latitude - halfHeight, 4);
    const maxLat = Util.round(latitude + halfHeight, 4);
    
    return [minLat, minLon, maxLat, maxLon];
  }

  static isLatLon(str: string) {
    return /(-?\d+\.\d+),\s*(-?\d+\.\d+)/.test(str.trim());
  }

  static parseLatLon(str: string) {
    const [lat, lon] = str.split(",")
      .map(str => str.trim())
      .map(str => Number(str));
    if (lat < -90 || lat > 90) {
      throw new Error("Latitude must be between -90 and 90");
    } else if (lon < -180 || lon > 180) {
      throw new Error("Longitude must be between -180 and 180");
    } else {
      return [lat, lon];
    }
  }

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
}

class App {
  $controls: HTMLElement | null;
  $favorites: HTMLElement | null;
  $jumpForm: HTMLFormElement | null;
  $jumpBox:  HTMLInputElement | null;
  map: StreetMap;

  constructor() {
    this.$controls = document.querySelector("section.controls");
    this.$favorites = document.querySelector("section.favorites");
    this.$jumpForm = document.querySelector("form.jump");
    this.$jumpBox = document.querySelector("input#jump");
    this.initFavorites();
    this.map = new StreetMap();
    this.map.clear();
    
    if (
      !this.$jumpForm ||
      !this.$jumpBox
      ) throw new Error("Element was not found")

    this.$jumpForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      console.log("Jumping to", this.$jumpBox!.value);
      await this.map.jump(this.$jumpBox!.value);
    })

    document.querySelector("button.show-controls")?.addEventListener("click", (e) => {
      this.$controls?.classList.remove("hide");
    });

    document.querySelector("button.hide-controls")?.addEventListener("click", (e) => {
      this.$controls?.classList.add("hide");
    })


  }

  static favorites: {[key: string]: string} = { //  Added by LLM Agent
    "Durham, NC, USA": "durham_nc.json",  
    "Taipei, Taiwan": "taipei_taiwan.json",
    "Paris, France": "paris-france.json",
    "Paris, Idaho, USA": "paris-idaho-usa.json",
    "Millennium Park, Chicago, IL, USA": "millennium-park-chicago-il-usa.json",
    "Raleigh, NC, USA": "raleigh-nc-usa.json",
    "Duke Gardens, Durham, NC, USA": "duke-gardens-durham-nc-usa.json",
  }

  async init(): Promise<void> { //  Added by LLM Agent
    await this.map.jump("Durham, NC, USA", null, "durham_nc.json")
  }

  initFavorites(): void { //  Added by LLM Agent
    // Adds favorites to the UI
    const $ul = document.createElement("UL");
    let listItems = "";
    for (let fav in App.favorites) {
      listItems += `<a href="#"><li data-name="${fav}" data-localjson="${App.favorites[fav]}">${fav}</li></a>`
    }
    $ul.innerHTML = listItems;
    this.$favorites?.append($ul);

  $ul.addEventListener("click", (ev: MouseEvent) => { //  Added by LLM Agent
      /*
      - if local file
        - fetch local file and display
      - else
        - query Nominatum and display
      */
      ev.preventDefault();
      const target = ev.target as HTMLElement | null; //  Added by LLM Agent
      if (!target || target.tagName !== "LI") return;

      const ds = target.dataset as DOMStringMap; //  Added by LLM Agent
      if (ds?.localjson) {
        console.log("TODO: fetch local:", ds.localjson);
        this.map.jump(ds.name, null, ds.localjson);
      } else {
        console.log("TODO: fetch via Overpass:", ds.name);
      }
    })
  }
}

class Nominatum {
  // API providers: https://wiki.openstreetmap.org/wiki/Nominatim#Alternatives_.2F_Third-party_providers
  // Check the usage policy before modifying!
  static PATHS = {
    'osmfoundation': "https://nominatim.openstreetmap.org/search?",  // Very limited throughput.  Do not use unless absolutely necessary
    "geocoding.ai": "https://nominatim.geocoding.ai/search?",  // geocoding.ai
  }

  static BASE_PATH = Nominatum.PATHS["geocoding.ai"];
  

  static async freeForm(queryString: string): Promise<any> { //  Added by LLM Agent
    const params = ["q=" + encodeURIComponent(queryString)];
    params.push("format=geojson");  // required to obtain centroid

    const response = await fetch(Nominatum.BASE_PATH + params.join("&"), {
      headers: {
        "Referer": "https://www.stvn.us/pages/contact",
      }
    });

    const json = await response.json();
    return json;
  }

  static getCentroid(json: any): number[] | undefined { //  Added by LLM Agent
    /*
    Input: JSON response from Nominatum API
    Return: coordinates of first location as array, eg [lat, long] / [1.23, 4.56]
    */
    if (!json.features) {
      console.error("Features not found.  Here's the response:");
      console.error(json);
      return;
    }
    const [long, lat] = json.features[0].geometry.coordinates;
    return [lat, long];
  }
}

class Layer {
  name: string; //  Added by LLM Agent
  tags: {[k:string]: null | string[]}; //  Added by LLM Agent
  color_line: string | null; //  Added by LLM Agent
  color_fill: string | null; //  Added by LLM Agent
  elements: any[]; //  Added by LLM Agent
  dispatchHash: Record<string, any> = {}; //  Added by LLM Agent

  constructor({name, tags, color_line, color_fill}: LayerOptions) { //  Added by LLM Agent
    /*
    tags = JS object: `{building: null, leisure: [park, garden], landuse: [grass, forest, meadow, orchard]}` where `null` represents ALL tags for that key
    */
    this.name = name;
    this.tags = tags;
    this.color_line = color_line;
    this.color_fill = color_fill;
    this.elements = [];  // collection of elements from OSM API response

    for (const key in tags) { //  Added by LLM Agent
      const tag = tags[key] as null | string[]; //  Added by LLM Agent
      if (tag !== null && !Array.isArray(tag)) {
        throw new Error("tag must be `null` or Array");
      }
    }
  }

  static relationHasCutouts(element: any): boolean { //  Added by LLM Agent
    /*
    Given a relation, is at least one of it's members role === 'inner'?
    */
    const m = element.members;
    if (m && m[m.length - 1].role === "inner") return true;
    return false;
  }

  static isClosed(element: any): boolean { //  Added by LLM Agent
    /*
    Limitation: for relations, this function checks to see if any duplicate points exist.  There's probably a better way.
    */
    if (element.type === "way") {

      const first = element.geometry[0];
      const last = element.geometry.slice(-1)[0];
      return JSON.stringify(first) === JSON.stringify(last);

    } else if (element.type === "relation") {
      
      const seen: string[] = []; //  Added by LLM Agent

      for (let member of element.members) {
        if (member.role === "inner" || member.type === "node") continue;
        for (let pt of member.geometry) {
          const pointString = JSON.stringify(pt);
          if (seen.indexOf(pointString) !== -1) return true; //  Added by LLM Agent
          seen.push(pointString);
        }
      }
      return false;
    }
    return false; //  Added by LLM Agent
  }

  draw({coords, elements, filterCB}: {coords: bbox | null, elements?: any[], filterCB?: (ele:any)=>boolean}): void { //  Added by LLM Agent
    /*
    REQ'D ARGS
      coords = required,
    OPTIONAL ARGS
      elements = array of elements to be drawn
      filterCB = callback to filter elements (ele)
    EXPECTED INPUT = ARRAY:
        [
          { "lat": 35.9945128, "lon": -78.9050525 },
          { "lat": 35.9945023, "lon": -78.9050263 },
          ...
        ]
    */
    const failed = [];

    if (this.color_line) {
      stroke(this.color_line);
    } else {
      noStroke();
    }
    
    elements = elements || this.elements;

    if (filterCB instanceof Function) {
      elements = elements.filter(filterCB);
      console.log(`Filtered elements for layer "${this.name}":`)
      console.info(elements);
    }

    for (let ele of elements) {
      try {

        // SET FILL COLOR
        if (Layer.isClosed(ele) && this.color_fill) {
          fill(this.color_fill);
        } else {
          noFill();
        }

        // SET STROKE WEIGHT
        strokeWeight(StreetMap.getStroke(ele));

        if (ele.type === "way") {
          beginShape();
          for (const pt of ele.geometry) {
            Layer.addVertex({coords, pt});
          }
          endShape();
        } else if (ele.type === "relation") {
          if (Layer.relationHasCutouts(ele)) {
            beginShape();
            // DRAW OUTER CONTOURS
            // ele.members.filter((member) => member.role === "outer")
            //   .map((member) => member.geometry)
            //   .forEach((pt) => Layer.addVertex({coords, pt, bounds:ele.bounds}));
            for (const member of ele.members.filter((m: any) => m.role === "outer")) { //  Added by LLM Agent
              const geo = member.geometry;
              for (let pt of geo) {
                Layer.addVertex({coords, pt, bounds:ele.bounds});
              }
            }

            for (const member of ele.members.filter((m: any) => m.role === "inner")) { //  Added by LLM Agent
              const geo = member.geometry;
              if (geo) {
                Layer.createCutout({coords, memberGeometry: geo, bounds:ele.bounds});
              }
            }
              
            endShape();
          } else {  // Relations w/ no cutouts
            for (const member of ele.members) {
              if (!member.geometry) continue;
              
              beginShape();
              
              for (const pt of member.geometry) {
                Layer.addVertex({coords, pt});
              }
              endShape();
            }
          }
        } else {
          console.log("ABORTING");
          console.log(ele);
          throw new Error("Can only draw ways and relations")
        }
      } catch (er) {
        failed.push(ele)
      }
    }
    if (failed.length > 0) {
      console.error("Some elements failed to draw:");
      console.error(failed);
    }
  }

  static createCutout({coords, memberGeometry, bounds}) {
  static createCutout({coords, memberGeometry, bounds}: {coords: bbox | null, memberGeometry: Array<{lat:number, lon:number}>, bounds?: any}): void { //  Added by LLM Agent
    /*
    Input = member.geometry eg '[{"lat":35.9894581,"lon":-78.8993456},...]'
    Return: none
    SideEffect = invocation of beginContour, drawVertex, endContour
    */
    beginContour();
    memberGeometry
      .slice().reverse()  // per p5 docs, inner countours (lines) must be drawn in opposite direction as shape (outer line)
      .forEach((pt: {lat:number, lon:number}) => { //  Added by LLM Agent
        Layer.addVertex({coords, pt, bounds});
      })
    endContour();
  }

  static addVertex({coords, pt, bounds}: {coords: any, pt: {lat:number, lon:number}, bounds?: any}): void { //  Added by LLM Agent
    /*
    point = eg {lat: 1.23, lon: 4.56}
    coords = OSM coords array eg [1.23, 4.56, 7.89, 9.99] (latMin, longMin, etc)
    */
    let latMin, longMin, latMax, longMax;
    if (DEBUG.drawLarge === true && bounds) {
      // Use bounds of element as min and max
      const {minlat, minlon, maxlat, maxlon} = bounds;
      [latMin, longMin, latMax, longMax] = [minlat, minlon, maxlat, maxlon];
    } else {
      [latMin, longMin, latMax, longMax] = coords;
    }
    let y = map(pt.lat, latMin, latMax, height, 0);
    let x = map(pt.lon, longMin, longMax, 0, width);
    if (DEBUG.drawVertices) point(x, y);
    vertex(x, y);
  }

  addElement(element: any): void { //  Added by LLM Agent
    /*
    Input = element from OSM json response
    Side effect = mutate this.elements
    */
    this.elements.push(element);
  }

  matchesTags(tags: {[k:string]: string}): boolean { //  Added by LLM Agent
    /*
    input = 
      - tags = eg {"destination:street":"Chapel Hill Street","highway":"motorway_link","lanes":"1","oneway":"yes","surface":"concrete"}
      - this.tags = eg {"leisure":["park","garden"],"landuse":["grass"]}
    return = boolean
    */
    for (const eleKey in tags) { //  Added by LLM Agent
      const eleTag = tags[eleKey] as string; //  Added by LLM Agent
      if (Object.keys(this.tags).indexOf(eleKey) !== -1 && (
          this.tags[eleKey] === null || (this.tags[eleKey] as string[]).indexOf(eleTag) !== -1)) {
        return true;
      }
    }
    return false;
  }

  get queryString() {
    let string = "";
    for (const key in this.tags) {
      const tags = this.tags[key];
      if (tags === null) {
        string += `wr["${key}"];`;
      } else if (tags.length > 1) {
        string += `wr["${key}"~"${tags.join("|")}"];`;
      } else {
        string += `wr["${key}"="${tags[0]}"];`;
      }
    }
    return string;
  }

}

/*
Map contains and orchestrates Layers
*/
class StreetMap {
  bbox: bbox | null;

  constructor() {
    this.bbox = null;
    this.data = {};
    this.query = null;
    // this.latMin = bbox[0];
    // this.longMin = bbox[1];
    // this.latMax = bbox[2];
    // this.longMax = bbox[3];

    this.layers = [];
    this.dispatchHash = {};

    this.populateDefaultLayers();
    this.updateDispatchHash();  // todo - remove?
  }

  static DEFAULT_ZOOM = 15;

  async init() {

  }

  async jump(
    query: string, 
    zoom: number | null = StreetMap.DEFAULT_ZOOM, 
    localJSON: string | null = null
    ) {
    /*
    INPUTS:
    - `query` text placename or query (string) (required)
    - `zoom` = only used if `localJSON` is null
    - `localJSON` = relative path to JSON (string) (optional) - Nominatum will be used if this argument is NOT provided
    RETURN: none
    SIDE EFFECTS: 
    - change `bbox` of `StreetMap`
    - save json so that it can be accessed elsewhere
    - `StreetMap` instance jumps to the location
    */
    this.currentLoc = query;

    if (localJSON) {
      // TODO: fetch local data 
      const response = await fetch("./data/" + localJSON);
      this.data = await response.json();
      this.bbox = this.data.bbox;
      this.centroid = this.data.centroid;
      // this.data = await this.fetchlayers();
      this.dispatchToLayers(this.data);
      this.clear();
      this.draw({filterCB: DEBUG.activeFilter});
    } else {
      if (Util.isLatLon(query)) {
        this.centroid = Util.parseLatLon(query);
      } else {
        const results = await Nominatum.freeForm(query);
        this.centroid = Nominatum.getCentroid(results);
      }
      this.bbox = Util.toBbox(this.centroid, zoom);
      // fetch data
      this.data = await this.fetchlayers();
      console.info("Successful fetch of map data:")
      console.info(this.data);
      this.dispatchToLayers(this.data);
      this.clear();
      this.draw({filterCB: DEBUG.activeFilter});
    }
  }

  saveData() {
    const path = Util.slugify(this.currentLoc) + ".json";
    this.data["bbox"] = this.bbox;
    this.data["centroid"] = this.centroid;
    Util.saveJSON(this.data, path);
    console.info("Saved");
    console.info(`"${this.currentLoc}": "${path}",`);
  }



  static colors = {
    bg: "rgb(241, 244, 203)",
    light: "rgba(255, 255, 255, 1)",
    dark: "rgb(65, 54, 51)",
    bright: "rgba(238, 86, 66, 1)",
    green: "rgba(153, 197, 114, 1)",
    blue: "rgba(138, 181, 204, 1)",
    ick: "rgba(115, 28, 122, 1)",
  }

  static strokesWeights = {
    faint: 0.3,
    light: 0.5,
    medium: 1.3,
    heavy: 2.5,
    super: 4,
  }


  // Top layers are drawn last
  static defaultLayers = [
    { 
      name: "Buildings - Residential",
      color_fill: StreetMap.colors.bright,
      color_line: StreetMap.colors.dark,
      tags: {
        building: ["house", "residential", "detached", "apartments", "semidetached_house", "bungalow", "dormitory"],
      },
    },
    { 
      name: "Buildings - All",
      color_fill: StreetMap.colors.dark,
      color_line: StreetMap.colors.bright,
      tags: {
        building: null,
      },
    },
    {
      name: "Paths",
      color_fill: StreetMap.colors.bg,
      color_line: StreetMap.colors.dark, 
      tags: {
        highway: ["footway", "service", "driveway", "path", "pedestrian"],
      },
    },
    {
      name: "Roads",
      color_fill: null,
      color_line: StreetMap.colors.dark,
      tags: {
        highway: ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link","residential", "service"]
      },
    },
    {
      name: "Water",
      color_fill: StreetMap.colors.blue,
      color_line: StreetMap.colors.dark,
      tags: {
        waterway: null,
        natural: ["water"],
      },
    },
    {
      name: "Green Space",
      color_fill: StreetMap.colors.green,
      color_line: StreetMap.colors.dark,
      tags: {
        leisure: ["park", "garden"],
        landuse: ["grass"],
      },
    },
    {
      name: "Public Space",
      color_fill: StreetMap.colors.green,
      color_line: StreetMap.colors.dark,
      tags: {
        leisure: ["village_green", "track", "dog_park"],
        amenity: ["school"],
      }
    },
    {
      name: "Parking",
      color_fill: StreetMap.colors.ick,
      color_line: StreetMap.colors.bg,
      tags: {
        parking: null,
        parking_space: null,
        amenity: ["parking"],
        building: ["parking", "parking_garage", "parking_shelter", "car_park", "parkingbuilding", "parking_deck"]
      }
    },
    {
      name: "No Tresspassing",
      color_fill: StreetMap.colors.bright,
      color_line: null,
      tags: {
        access: ["private"],
      },
    },
  ];


  static getStroke(element) {
    /*
    TODO: adjust based on zoom level
    */
    const e = element;
    const w = StreetMap.strokesWeights;
    if ([
      "motorway", 
      "motorway_link", 
      "trunk", 
      "primary", 
      "primary_link"
    ].includes(e.tags.highway)) {
      return w.super;
    }
    if (["secondary", "tertiary", "tertiary_link"].includes(e.tags.highway)) {
      return w.heavy;
    }
    if (["residential", "service"].includes(e.tags.highway)) {
      return w.medium;
    }
    if (["footway", "service", "driveway"].includes(e.tags.highway)) {
      return w.light;
    }
    if ("building" in e.tags) {
      return w.light;
    }
    return w.faint;
  }

  clear() {
    background(StreetMap.colors.bg);
  }

  draw({filterCB}) {
    for (const layer of this.layers.toReversed()) {
      layer.draw({coords: this.bbox, filterCB})
    }
  }

  dispatchToLayers(json) {
    /*
    Input: json response from OSM
    Side effects: 
      1) Warn if orphans are found
      2) Dispatch elements from json to each Layer
    */
    const orphanElements = [];
    let foundCount = 0;

    elementIteration: for (const element of json.elements) {

      for (let layer of this.layers) {
        if (layer.matchesTags(element.tags)) {
          foundCount += 1;
          layer.addElement(element);
          continue elementIteration;
        }
      }
      // push to 'orphans' if not found in any layer
      orphanElements.push(element);
    }
    if (orphanElements.length > 0) {
      console.error(`Warning: layers could not be found for ${orphanElements.length} elements!`);
      console.error(orphanElements);
    }
    console.log(`Dispatched ${foundCount} elements to layers.`)
  }

  get coordString() {
    return this.bbox.join(",");
  }

  updateDispatchHash() {
    this.layers.forEach((layer) => {
      Object.assign(this.dispatchHash, layer.dispatchHash);
    })
  }

  populateDefaultLayers() {
    for (const l of StreetMap.defaultLayers) {
      this.layers.push(new Layer(l));
    }
  }

  async fetchlayers(layerNames=[]) {
    /*
    Input: (optional) layers to fetch data for.  
      If none are provided, this.layers will be used
    Return: JSON response
    parse response and populate each layer with elements
    */

    // if (OFFLINE) {
    //   const response = await fetch("./data_durham.json");
    //   const json = await response.json();
    //   console.log(`(OFFLINE) Fetched ${json.elements.length} elements`)
    //   return json;
    // }

    
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
}

function setupListeners() {
  document.body.addEventListener("click", async (ev) => {
    console.log("TODO - DISABLED FOR NOW")
    // renderTile(coords, await fetchFromOSM(coords, [myQueries.building]), null);
  })
  console.log("Click to load: setup complete.");
}



function renderTile([latMin, longMin, latMax, longMax], json, color) {
    json.elements.forEach((object) => {
      if (object.type === "way") {
        drawGeometry(object.geometry, {latMin, longMin, latMax, longMax}, color);
      } else if (object.type === "relation") {
        object.members.forEach((member) => {
          if (member.type === "way") {
            drawGeometry(member.geometry, {latMin, longMin, latMax, longMax}, color);
          }
        })
      }
    });

}

function drawGeometry(geoArray, {latMin, longMin, latMax, longMax}, fillColor=255) {
  /*
  EXPECTED INPUT = ARRAY:
      [
         { "lat": 35.9945128, "lon": -78.9050525 },
         { "lat": 35.9945023, "lon": -78.9050263 },
         ...
      ]
  */
  beginShape();
  if (fillColor) {
    fill(fillColor);
  } else {
    noFill();
  }
  geoArray.forEach((point) => {
    let y = map(point.lat, latMin, latMax, height, 0);
    let x = map(point.lon, longMin, longMax, 0, width);
    vertex(x, y);
  });
  endShape();
}

class TestCoordinates {
  static coords = {
    Taipei: [25.029928, 121.470337, 25.054501, 121.499004],
    Durham: [35.985577, -78.913336, 36.004673, -78.888788],
    Chicago: [41.876032,-87.625859,41.884707,-87.614164],
    Amsterdam: [52.357112,4.865248,52.365027,4.878166],
    Amsterdam2: Util.toBbox([52.64648, 4.80682], 15),

  }
}

///////////////////////////////////////////////////////////
// GLOBALS AND CONFIG
const OFFLINE = false;
const TIMEOUT = 10;  // unit = seconds
const REQUEST_DELAY = 3000;  // delay to play nice with OSM servers
const coords = TestCoordinates.coords.Durham;

let done = false;

const myQueries = {
  building: `wr["building"];`,
  road: `wr["highway"~"motorway|motorway_link|trunk|primary|secondary|tertiary|residential|service"];`,
  green_space: `
    wr["leisure"~"park|garden"];
    wr["landuse"~"grass|forest|meadow|orchard"];`,
  farm: `wr["landuse"~"farmyard|vineyard"];`,
  industrial: `wr["landuse"~"industrial|quarry|brownfield|military|logging|landfill"];`
}


///////////////////////////////////////////////////////////
// APP LOGIC

const osmFetcher = new SlowFetcher(REQUEST_DELAY);
let app;


const FILTERS = {
  none: null,

  cutouts(ele) {
    return (
      ele.id === 355718 ||  // running track w/ inner and outer
      ele.id === 3423713 || // church
      ele.id === 7586589 || // grass thingy?
      ele.members && ele.members.length === 4
    )
  }
}

const DEBUG = {
  activeFilter: FILTERS.none,
  drawLarge: false,
  drawVertices: false,
}

async function setup() {
  document.body.style.backgroundColor = StreetMap.colors.bg;
  createCanvas(800, 800);
  noFill();
  strokeWeight(0.5);
  console.log("loading...");

  app = new App();
  await app.init();

  console.log("Setup is complete!")
}
