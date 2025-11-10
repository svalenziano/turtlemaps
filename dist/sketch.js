"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
// CLASSES AND HELPER FUNCTIONS
// There are more robust methods of throttling, but this does the trick for now
class SlowFetcher {
    constructor(milliseconds) {
        this.queue = [];
        this.milliseconds = milliseconds; // Minimum interval between requests.  unit = milliseconds
        this.timer = null;
    }
    fetch(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let resolve;
            let reject;
            const futureFetch = new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            });
            // IF TIMER EXISTS, PUSH ARGUMENTS TO QUEUE FOR FUTURE FETCHING
            if (this.timer !== null) {
                this.queue.push({ url, options, resolve, reject });
                console.log("SlowFetcher: Pushing new fetch to queue");
                console.log(this.queue);
                return futureFetch;
                // IF NO TIMER EXISTS, CREATE THE TIMER AND PROCESS THIS FETCH IMMEDIATELY
            }
            else {
                // CREATE TIMER that resolves the `futureFetch`
                console.log("SlowFetcher: Creating timer");
                this.timer = setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    if (this.queue.length > 0) {
                        const { url, options, resolve, reject } = this.queue.shift();
                        const response = yield fetch(url, options);
                        if (response.ok) {
                            resolve(response);
                        }
                        else {
                            reject(response);
                        }
                    }
                    else {
                        console.log("SlowFetcher: Destroying timer");
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                }), this.milliseconds);
                // PROCESS IMMEDIATELY and return Promise
                // no `await`, since we want this method to act exactly like the native `fetch`
                return fetch(url, options);
            }
        });
    }
}
class Util {
    /*
    Misc utilities
    */
    static saveJSON(data, filename) {
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
    static round(num, places) {
        /*
        Returns number
        */
        return Number(num.toFixed(places));
    }
    static toBbox([latitude, longitude], zoom) {
        /*
        Credit: LLM
        Zoom levels: https://wiki.openstreetmap.org/wiki/Zoom_levels
        tktk: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Implementations
        */
        const earthRadius = 6378137; // meters
        const earthCircumference = 2 * Math.PI * earthRadius;
        // Calculate the pixel size at the given zoom level
        const pixelsPerTile = 256;
        const metersPerPixel = earthCircumference / (pixelsPerTile * (Math.pow(2, zoom)));
        // Convert meters to degrees (approximate)
        const metersPerDegreeLat = 111320; // meters per degree of latitude
        const metersPerDegreeLon = Math.abs(Math.cos(latitude * Math.PI / 180) * metersPerDegreeLat);
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
    static isLatLon(string) {
        return /(-?\d+\.\d+),\s*(-?\d+\.\d+)/.test(string.trim());
    }
    static parseLatLon(string) {
        const [lat, lon] = string.split(",")
            .map(str => str.trim())
            .map(str => Number(str));
        if (lat < -90 || lat > 90) {
            throw new Error("Latitude must be between -90 and 90");
        }
        else if (lon < -180 || lon > 180) {
            throw new Error("Longitude must be between -180 and 180");
        }
        else {
            return [lat, lon];
        }
    }
    static slugify(str) {
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
    constructor() {
        this.$controls = document.querySelector("section.controls");
        this.$favorites = document.querySelector("section.favorites");
        this.$jumpForm = document.querySelector("form.jump");
        this.$jumpBox = document.querySelector("input#jump");
        this.initFavorites();
        this.map = new StreetMap();
        this.map.clear();
        this.$jumpForm.addEventListener("submit", (ev) => __awaiter(this, void 0, void 0, function* () {
            ev.preventDefault();
            console.log("Jumping to", this.$jumpBox.value);
            yield this.map.jump(this.$jumpBox.value);
        }));
        document.querySelector("button.show-controls").addEventListener("click", (e) => {
            this.$controls.classList.remove("hide");
        });
        document.querySelector("button.hide-controls").addEventListener("click", (e) => {
            this.$controls.classList.add("hide");
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.map.jump("Durham, NC, USA", null, "durham_nc.json");
        });
    }
    initFavorites() {
        // Adds favorites to the UI
        const $ul = document.createElement("UL");
        let listItems = "";
        for (let fav in App.favorites) {
            listItems += `<a href="#"><li data-name="${fav}" data-localjson="${App.favorites[fav]}">${fav}</li></a>`;
        }
        $ul.innerHTML = listItems;
        this.$favorites.append($ul);
        $ul.addEventListener("click", (ev) => {
            var _a;
            /*
            - if local file
              - fetch local file and display
            - else
              - query Nominatum and display
            */
            ev.preventDefault();
            if (ev.target.tagName !== "LI")
                return;
            if ((_a = ev.target.dataset) === null || _a === void 0 ? void 0 : _a.localjson) {
                console.log("TODO: fetch local:", ev.target.dataset.localjson);
                this.map.jump(ev.target.dataset.name, null, ev.target.dataset.localjson);
            }
            else {
                console.log("TODO: fetch via Overpass:", ev.target.dataset.name);
            }
        });
    }
}
App.favorites = {
    "Durham, NC, USA": "durham_nc.json",
    "Taipei, Taiwan": "taipei_taiwan.json",
    "Paris, France": "paris-france.json",
    "Paris, Idaho, USA": "paris-idaho-usa.json",
    "Millennium Park, Chicago, IL, USA": "millennium-park-chicago-il-usa.json",
    "Raleigh, NC, USA": "raleigh-nc-usa.json",
    "Duke Gardens, Durham, NC, USA": "duke-gardens-durham-nc-usa.json",
};
class Nominatum {
    static freeForm(queryString) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = ["q=" + encodeURIComponent(queryString)];
            params.push("format=geojson"); // required to obtain centroid
            const response = yield fetch(Nominatum.BASE_PATH + params.join("&"), {
                headers: {
                    "Referer": "https://www.stvn.us/pages/contact",
                }
            });
            const json = yield response.json();
            return json;
        });
    }
    static getCentroid(json) {
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
// API providers: https://wiki.openstreetmap.org/wiki/Nominatim#Alternatives_.2F_Third-party_providers
// Check the usage policy before modifying!
Nominatum.PATHS = {
    'osmfoundation': "https://nominatim.openstreetmap.org/search?", // Very limited throughput.  Do not use unless absolutely necessary
    "geocoding.ai": "https://nominatim.geocoding.ai/search?", // geocoding.ai
};
Nominatum.BASE_PATH = Nominatum.PATHS["geocoding.ai"];
class Layer {
    constructor({ name, tags, color_line, color_fill }) {
        /*
        tags = JS object: `{building: null, leisure: [park, garden], landuse: [grass, forest, meadow, orchard]}` where `null` represents ALL tags for that key
        */
        this.name = name;
        this.tags = tags;
        this.color_line = color_line;
        this.color_fill = color_fill;
        this.elements = []; // collection of elements from OSM API response
        Object.values(tags).forEach((tag) => {
            if (tag !== null && !Array.isArray(tag)) {
                throw new Error("tag must be `null` or Array");
            }
        });
    }
    static relationHasCutouts(element) {
        /*
        Given a relation, is at least one of it's members role === 'inner'?
        */
        const m = element.members;
        if (m && m[m.length - 1].role === "inner")
            return true;
        return false;
    }
    static isClosed(element) {
        /*
        Limitation: for relations, this function checks to see if any duplicate points exist.  There's probably a better way.
        */
        if (element.type === "way") {
            const first = element.geometry[0];
            const last = element.geometry.slice(-1)[0];
            return JSON.stringify(first) === JSON.stringify(last);
        }
        else if (element.type === "relation") {
            const seen = [];
            for (let member of element.members) {
                if (member.role === "inner" || member.type === "node")
                    continue;
                for (let pt of member.geometry) {
                    const pointString = JSON.stringify(pt);
                    if (seen.includes(pointString))
                        return true;
                    seen.push(pointString);
                }
            }
            return false;
        }
    }
    draw({ coords, elements, filterCB }) {
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
        }
        else {
            noStroke();
        }
        elements = elements || this.elements;
        if (filterCB instanceof Function) {
            elements = elements.filter(filterCB);
            console.log(`Filtered elements for layer "${this.name}":`);
            console.info(elements);
        }
        for (let ele of elements) {
            try {
                // SET FILL COLOR
                if (Layer.isClosed(ele) && this.color_fill) {
                    fill(this.color_fill);
                }
                else {
                    noFill();
                }
                // SET STROKE WEIGHT
                strokeWeight(StreetMap.getStroke(ele));
                if (ele.type === "way") {
                    beginShape();
                    for (const pt of ele.geometry) {
                        Layer.addVertex({ coords, pt });
                    }
                    endShape();
                }
                else if (ele.type === "relation") {
                    if (Layer.relationHasCutouts(ele)) {
                        beginShape();
                        // DRAW OUTER CONTOURS
                        // ele.members.filter((member) => member.role === "outer")
                        //   .map((member) => member.geometry)
                        //   .forEach((pt) => Layer.addVertex({coords, pt, bounds:ele.bounds}));
                        for (const member of ele.members.filter((m) => m.role === "outer")) {
                            const geo = member.geometry;
                            for (let pt of geo) {
                                Layer.addVertex({ coords, pt, bounds: ele.bounds });
                            }
                        }
                        for (const member of ele.members.filter((m) => m.role === "inner")) {
                            const geo = member.geometry;
                            if (geo) {
                                Layer.createCutout({ coords, memberGeometry: geo, bounds: ele.bounds });
                            }
                        }
                        endShape();
                    }
                    else { // Relations w/ no cutouts
                        for (const member of ele.members) {
                            if (!member.geometry)
                                continue;
                            beginShape();
                            for (const pt of member.geometry) {
                                Layer.addVertex({ coords, pt });
                            }
                            endShape();
                        }
                    }
                }
                else {
                    console.log("ABORTING");
                    console.log(ele);
                    throw new Error("Can only draw ways and relations");
                }
            }
            catch (er) {
                failed.push(ele);
            }
        }
        if (failed.length > 0) {
            console.error("Some elements failed to draw:");
            console.error(failed);
        }
    }
    static createCutout({ coords, memberGeometry, bounds }) {
        /*
        Input = member.geometry eg '[{"lat":35.9894581,"lon":-78.8993456},...]'
        Return: none
        SideEffect = invocation of beginContour, drawVertex, endContour
        */
        beginContour();
        memberGeometry
            .toReversed() // per p5 docs, inner countours (lines) must be drawn in opposite direction as shape (outer line)
            .forEach((pt) => {
            Layer.addVertex({ coords, pt, bounds });
        });
        endContour();
    }
    static addVertex({ coords, pt, bounds }) {
        /*
        point = eg {lat: 1.23, lon: 4.56}
        coords = OSM coords array eg [1.23, 4.56, 7.89, 9.99] (latMin, longMin, etc)
        */
        let latMin, longMin, latMax, longMax;
        if (DEBUG.drawLarge === true && bounds) {
            // Use bounds of element as min and max
            const { minlat, minlon, maxlat, maxlon } = bounds;
            [latMin, longMin, latMax, longMax] = [minlat, minlon, maxlat, maxlon];
        }
        else {
            [latMin, longMin, latMax, longMax] = coords;
        }
        let y = map(pt.lat, latMin, latMax, height, 0);
        let x = map(pt.lon, longMin, longMax, 0, width);
        if (DEBUG.drawVertices)
            point(x, y);
        vertex(x, y);
    }
    addElement(element) {
        /*
        Input = element from OSM json response
        Side effect = mutate this.elements
        */
        this.elements.push(element);
    }
    matchesTags(tags) {
        /*
        input =
          - tags = eg {"destination:street":"Chapel Hill Street","highway":"motorway_link","lanes":"1","oneway":"yes","surface":"concrete"}
          - this.tags = eg {"leisure":["park","garden"],"landuse":["grass"]}
        return = boolean
        */
        for (let [eleKey, eleTag] of Object.entries(tags)) {
            if (Object.keys(this.tags).includes(eleKey) && (this.tags[eleKey] === null || this.tags[eleKey].includes(eleTag))) {
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
            }
            else if (tags.length > 1) {
                string += `wr["${key}"~"${tags.join("|")}"];`;
            }
            else {
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
        this.updateDispatchHash(); // todo - remove?
    }
    jump(query_1) {
        return __awaiter(this, arguments, void 0, function* (query, zoom = StreetMap.DEFAULT_ZOOM, localJSON) {
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
                const response = yield fetch("./data/" + localJSON);
                this.data = yield response.json();
                this.bbox = this.data.bbox;
                this.centroid = this.data.centroid;
                // this.data = await this.fetchlayers();
                this.dispatchToLayers(this.data);
                this.clear();
                this.draw({ filterCB: DEBUG.activeFilter });
            }
            else {
                if (Util.isLatLon(query)) {
                    this.centroid = Util.parseLatLon(query);
                }
                else {
                    const results = yield Nominatum.freeForm(query);
                    this.centroid = Nominatum.getCentroid(results);
                }
                this.bbox = Util.toBbox(this.centroid, zoom);
                // fetch data
                this.data = yield this.fetchlayers();
                console.info("Successful fetch of map data:");
                console.info(this.data);
                this.dispatchToLayers(this.data);
                this.clear();
                this.draw({ filterCB: DEBUG.activeFilter });
            }
        });
    }
    saveData() {
        const path = Util.slugify(this.currentLoc) + ".json";
        this.data["bbox"] = this.bbox;
        this.data["centroid"] = this.centroid;
        Util.saveJSON(this.data, path);
        console.info("Saved");
        console.info(`"${this.currentLoc}": "${path}",`);
    }
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
    draw({ filterCB }) {
        for (const layer of this.layers.toReversed()) {
            layer.draw({ coords: this.bbox, filterCB });
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
        console.log(`Dispatched ${foundCount} elements to layers.`);
    }
    get coordString() {
        return this.bbox.join(",");
    }
    updateDispatchHash() {
        this.layers.forEach((layer) => {
            Object.assign(this.dispatchHash, layer.dispatchHash);
        });
    }
    populateDefaultLayers() {
        for (const l of StreetMap.defaultLayers) {
            this.layers.push(new Layer(l));
        }
    }
    fetchlayers() {
        return __awaiter(this, arguments, void 0, function* (layerNames = []) {
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
                const response = yield osmFetcher.fetch("https://overpass-api.de/api/interpreter", {
                    method: "POST",
                    body: osmQuery,
                });
                const json = yield response.json();
                console.log(`Fetched ${json.elements.length} elements`);
                return json;
            }
            else {
                throw new Error("NOT YET IMPLEMENTED");
            }
        });
    }
}
StreetMap.DEFAULT_ZOOM = 15;
StreetMap.colors = {
    bg: "rgb(241, 244, 203)",
    light: "rgba(255, 255, 255, 1)",
    dark: "rgb(65, 54, 51)",
    bright: "rgba(238, 86, 66, 1)",
    green: "rgba(153, 197, 114, 1)",
    blue: "rgba(138, 181, 204, 1)",
    ick: "rgba(115, 28, 122, 1)",
};
StreetMap.strokesWeights = {
    faint: 0.3,
    light: 0.5,
    medium: 1.3,
    heavy: 2.5,
    super: 4,
};
// Top layers are drawn last
StreetMap.defaultLayers = [
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
            highway: ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "service"]
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
function setupListeners() {
    document.body.addEventListener("click", (ev) => __awaiter(this, void 0, void 0, function* () {
        console.log("TODO - DISABLED FOR NOW");
        // renderTile(coords, await fetchFromOSM(coords, [myQueries.building]), null);
    }));
    console.log("Click to load: setup complete.");
}
function renderTile([latMin, longMin, latMax, longMax], json, color) {
    json.elements.forEach((object) => {
        if (object.type === "way") {
            drawGeometry(object.geometry, { latMin, longMin, latMax, longMax }, color);
        }
        else if (object.type === "relation") {
            object.members.forEach((member) => {
                if (member.type === "way") {
                    drawGeometry(member.geometry, { latMin, longMin, latMax, longMax }, color);
                }
            });
        }
    });
}
function drawGeometry(geoArray, { latMin, longMin, latMax, longMax }, fillColor = 255) {
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
    }
    else {
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
}
TestCoordinates.coords = {
    Taipei: [25.029928, 121.470337, 25.054501, 121.499004],
    Durham: [35.985577, -78.913336, 36.004673, -78.888788],
    Chicago: [41.876032, -87.625859, 41.884707, -87.614164],
    Amsterdam: [52.357112, 4.865248, 52.365027, 4.878166],
    Amsterdam2: Util.toBbox([52.64648, 4.80682], 15),
};
///////////////////////////////////////////////////////////
// GLOBALS AND CONFIG
const OFFLINE = false;
const TIMEOUT = 10; // unit = seconds
const REQUEST_DELAY = 3000; // delay to play nice with OSM servers
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
};
///////////////////////////////////////////////////////////
// APP LOGIC
const osmFetcher = new SlowFetcher(REQUEST_DELAY);
let app;
const FILTERS = {
    none: null,
    cutouts(ele) {
        return (ele.id === 355718 || // running track w/ inner and outer
            ele.id === 3423713 || // church
            ele.id === 7586589 || // grass thingy?
            ele.members && ele.members.length === 4);
    }
};
const DEBUG = {
    activeFilter: FILTERS.none,
    drawLarge: false,
    drawVertices: false,
};
function svgElement(type) {
}
function drawSVG() {
}
function setup() {
    return __awaiter(this, void 0, void 0, function* () {
        document.body.style.backgroundColor = StreetMap.colors.bg;
        createCanvas(800, 800);
        noFill();
        strokeWeight(0.5);
        console.log("loading...");
        app = new App();
        yield app.init();
        console.log("Setup is complete!");
    });
}
