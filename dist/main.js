var _a;
// CLASSES
class BBox {
    constructor() {
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
        this.bottom = null;
        this.left = null;
        this.top = null;
        this.right = null;
        // Original values
        this.oBottom = null;
        this.oLeft = null;
        this.oTop = null;
        this.oRight = null;
        this.oWidth = null;
        this.oHeight = null;
    }
    parseLatitudeFirst(bbox) {
        // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
        [this.bottom, this.left, this.top, this.right] = bbox;
        [this.oBottom, this.oLeft, this.oTop, this.oRight] = bbox;
        this.oWidth = this.width;
        this.oHeight = this.height;
    }
    /*
    Crop or re-crop the original bbox to match the SVG aspect ratio
    */
    crop(svgWidth, svgHeight) {
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
            }
            else {
                // Get the height that matches the svg aspect ratio
                const newBboxHeight = this.oWidth * svgHeight / svgWidth;
                // Crop top and bottom from the box
                const center = (this.oBottom + this.oTop) / 2;
                this.bottom = center - (newBboxHeight / 2);
                this.top = center + (newBboxHeight / 2);
            }
        }
    }
    isValid() {
        return (typeof this.bottom === "number" &&
            typeof this.left === "number" &&
            typeof this.top === "number" &&
            typeof this.right === "number" &&
            typeof this.oBottom === "number" &&
            typeof this.oLeft === "number" &&
            typeof this.oTop === "number" &&
            typeof this.oRight === "number" &&
            typeof this.oWidth === "number" &&
            typeof this.oHeight === "number");
    }
    // TODO: NOT WORKING, DO NOT USE
    // Positive numbers are required for width and height
    // "Values for width or height lower or equal to 0 disable rendering of the element."
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox
    get svgViewBox() {
        return [this.left, this.bottom, this.width, this.height].join(" ");
    }
    get width() {
        if (this.left !== null && this.right !== null) {
            return Math.abs(this.right - this.left);
        }
        else {
            throw new Error("Not initialized");
        }
    }
    get height() {
        if (this.top !== null && this.bottom !== null) {
            return Math.abs(this.top - this.bottom);
        }
        else {
            throw new Error("Not initialized");
        }
    }
}
/**
 * Misc. utility functions
 */
class U {
    // Based on p5js implementation https://github.com/processing/p5.js/blob/44341795ec65d956b9efe3290da478519dcf01bd/src/math/calculation.js#L605
    static map(val, start1, stop1, start2, stop2, withinBounds = false) {
        const newval = (val - start1) / (stop1 - start1) * (stop2 - start2) + start2;
        if (!withinBounds) {
            return newval;
        }
        if (start2 < stop2) {
            return this.constrain(newval, start2, stop2);
        }
        else {
            return this.constrain(newval, stop2, start2);
        }
    }
    ;
    static constrain(val, min, max) {
        if (min >= max)
            throw new Error("Min should be less than max");
        if (val <= min)
            return min;
        if (val >= max)
            return max;
        else
            return val;
    }
    static dist(x1, y1, x2, y2) {
        return Math.hypot(x1 - x2, y1 - y2);
    }
    static saveSVG(svg) {
        if (!svg) {
            const s = document.querySelector("svg");
            if (!s)
                throw new Error("SVG was not provided");
            svg = s;
        }
        let data = (new XMLSerializer()).serializeToString(svg);
        let svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
        let url = URL.createObjectURL(svgBlob);
        triggerDownload(url);
        function triggerDownload(imgURI, filename = "image.svg") {
            let a = document.createElement('a');
            a.setAttribute('download', filename);
            a.setAttribute('href', imgURI);
            a.setAttribute('target', '_blank');
            a.click();
        }
    }
}
/**
 * OSM Utility functions
 */
class OSM {
    /**
     * Convert `{lat: 1.23, lon: 3.45}` to `[3.45, 1.23]`
     */
    static convertPoint(pt) {
        return [pt.lon, pt.lat];
    }
}
/**
 * SVG utility functions
 */
class SVG {
    static makeElement(type) {
        return document.createElementNS("http://www.w3.org/2000/svg", type);
    }
    /**
     * Draw a path with or without inner boundaries
     * @param points List of points or nested list of points
     *
     * @todo
     */
    static makePath(points) {
        /*
        - If `points` is an array of points, (typeof points[0][0] is a number)
          - push command using makeSVGPathCommand
        - Else (`points` is an nested array of points):
          - for each array of points:
            - push to commands (same as above)
        - add commands to path
        - return path
        */
        const path = SVG.makeElement("path");
        let commands = "";
        // Handle simple list of points
        if (SVG.isListOfPoints(points)) {
            commands = SVG.PathCommand(points);
            path.setAttribute("d", commands);
            if (SVG.pathIsOpen(points)) {
                path.setAttribute("fill", "none");
            }
            return path;
        }
        // Otherwise, handle nested list of points
        for (let listOfPoints of points) {
            commands += SVG.PathCommand(listOfPoints);
        }
        path.setAttribute("d", commands);
        path.setAttribute("fill-rule", "evenodd");
        if (SVG.pathIsOpen(points[0])) {
            path.setAttribute("fill", "none");
        }
        return path;
    }
    static isListOfPoints(arr) {
        if (Array.isArray(arr[0][0])) { // eg [[[0,1], [0,1]], [[3,4]]]
            return false;
        }
        return true;
    }
    /**
     * @param points Points that form the boundary to be tested
     * @param maxOpen The threshold at which the path is considered "open"
     */
    static pathIsOpen(points, maxOpen = 0.01) {
        const first = points[0];
        const last = points[points.length - 1];
        if (U.dist(first[0], first[1], last[0], last[1]) > maxOpen) {
            return true;
        }
        return false;
    }
    /**
     * From a list of points `[x, y]`, form and return a "Command string" as described by
     * [MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths#curve_commands)
     *
     * @remarks
     * - Command strings may be joined by a space to form shapes with inner boundaries.
     * - First command is always a "M"
     * - Relative coordinates are NOT supported
     */
    static PathCommand(points, close = false) {
        if (points.length < 2) {
            throw new DataError("At least 2 points are required");
        }
        // First command is always "M" (move to)
        let commands = [`M ${points[0][0]},${points[0][1]}`];
        // Subsequent commands are always "L" (line to)
        for (let i = 1; i < points.length; i++) {
            commands.push(`L ${points[i][0]},${points[i][1]}`);
        }
        return commands.join(" ");
    }
}
class Colors {
}
Colors.default = {
    bg: "rgb(241, 244, 203)",
    light: "rgba(255, 255, 255, 1)",
    dark: "rgb(65, 54, 51)",
    bright: "rgba(238, 86, 66, 1)",
    green: "rgba(153, 197, 114, 1)",
    blue: "rgba(138, 181, 204, 1)",
    ick: "rgba(115, 28, 122, 1)",
};
/**
 * Intent: use when data from an API is not formed as you expect
 */
class DataError extends Error {
    constructor(msg) {
        super(msg);
        Object.setPrototypeOf(this, DataError.prototype);
        this.name = "DataError";
        this.date = new Date();
    }
}
class Layer {
    constructor(options) {
        this.name = options.name;
        this.colorFill = options.colorFill;
        this.colorStroke = options.colorStroke;
        this.strokeWeight = options.strokeWeight;
        this.tags = options.tags;
        this.$g = SVG.makeElement("g");
        this.updateStyles();
    }
    /**
     * Create and return an array of layers created with `this.defaultLayers`
     */
    static makeDefaultLayers() {
        return _a.defaultLayers.map((options) => new _a(options));
    }
    /**
     * Apply / re-apply styles to this.$g
     */
    updateStyles() {
        var _b, _c;
        this.$g.setAttribute("fill", (_b = this.colorFill) !== null && _b !== void 0 ? _b : "none");
        this.$g.setAttribute("stroke", (_c = this.colorStroke) !== null && _c !== void 0 ? _c : "none");
        this.$g.setAttribute("stroke-width", this.strokeWeight ? String(this.strokeWeight) : "0");
    }
    /**
     * Does this layer match the provided tags?
     * @param tags eg `{
        "destination:street":"Chapel Hill Street",
        "highway":"motorway_link",
        "lanes":"1",
        "oneway":"yes",
        "surface":"concrete"
        }`
     */
    matchesTags(tags) {
        /*
        input =
          - tags = tags object from OSM response, eg: {"destination:street":"Chapel Hill Street","highway":"motorway_link","lanes":"1","oneway":"yes","surface":"concrete"}
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
    addGeometry(ele) {
        this.$g.append(ele);
    }
}
_a = Layer;
Layer.strokesWeights = {
    faint: 0.3,
    light: 0.5,
    medium: 1.3,
    heavy: 2.5,
    super: 4,
};
/**
  *  Parse order: as listed (first elements in the array are processed first)
  *  Draw order: reverse order (first elements in the array are drawn last)
  */
Layer.defaultLayers = [
    {
        name: "Buildings - Residential",
        colorFill: Colors.default.bright,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            building: ["house", "residential", "detached", "apartments", "semidetached_house", "bungalow", "dormitory"],
        },
    },
    {
        name: "Buildings - All",
        colorFill: Colors.default.dark,
        colorStroke: Colors.default.bright,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            building: null,
        },
    },
    {
        name: "Paths",
        colorFill: Colors.default.bg,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            highway: ["footway", "service", "driveway", "path", "pedestrian"],
        },
    },
    {
        name: "Primary Roads",
        colorFill: null,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.super,
        tags: {
            highway: ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",]
        },
    },
    {
        name: "Secondary Roads",
        colorFill: null,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.heavy,
        tags: {
            highway: ["secondary", "secondary_link", "tertiary", "tertiary_link",]
        },
    },
    {
        name: "Tertiary Roads",
        colorFill: null,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.medium,
        tags: {
            highway: ["residential", "service"]
        },
    },
    {
        name: "Paths",
        colorFill: null,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.light,
        tags: {
            highway: ["footway", "service", "driveway"]
        },
    },
    {
        name: "Water",
        colorFill: Colors.default.blue,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            waterway: null,
            natural: ["water"],
        },
    },
    {
        name: "Green Space",
        colorFill: Colors.default.green,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            leisure: ["park", "garden"],
            landuse: ["grass"],
        },
    },
    {
        name: "Public Space",
        colorFill: Colors.default.green,
        colorStroke: Colors.default.dark,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            leisure: ["village_green", "track", "dog_park"],
            amenity: ["school"],
        }
    },
    {
        name: "Parking",
        colorFill: Colors.default.ick,
        colorStroke: Colors.default.bg,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            parking: null,
            parking_space: null,
            amenity: ["parking"],
            building: ["parking", "parking_garage", "parking_shelter", "car_park", "parkingbuilding", "parking_deck"]
        }
    },
    {
        name: "No Tresspassing",
        colorFill: Colors.default.bright,
        colorStroke: null,
        strokeWeight: _a.strokesWeights.faint,
        tags: {
            access: ["private"],
        },
    },
];
class MapApp {
    constructor(container) {
        this.container = container;
        this.svgWidth = window.innerWidth;
        this.svgHeight = window.innerWidth;
        this.bbox = new BBox();
        this.query = null;
        this.centroid = null;
        this.$svg = this.makeSVG();
        this.layers = Layer.makeDefaultLayers();
        this.layers.forEach((l) => this.$svg.append(l.$g));
        this.container.append(this.$svg);
    }
    makeSVG() {
        let svg = SVG.makeElement("svg");
        svg.setAttribute("width", String(this.svgWidth));
        svg.setAttribute("height", String(this.svgHeight));
        svg.setAttribute("viewBox", `0 0 ${this.svgWidth} ${this.svgHeight}`);
        let rect = SVG.makeElement("rect");
        rect.setAttribute("x", "0");
        rect.setAttribute("y", "0");
        rect.setAttribute("width", String(this.svgWidth));
        rect.setAttribute("height", String(this.svgHeight));
        rect.setAttribute("fill", Colors.default.bg);
        svg.append(rect);
        return svg;
    }
    /**
     * Side effects: updates app state based on response
     *
     * @returns response JSON
     */
    async fetchOSM(query) {
        try {
            const response = await fetch(query);
            const json = await response.json();
            if (json.bbox) {
                this.bbox.parseLatitudeFirst(json.bbox);
            }
            else {
                throw new DataError("no bbox was found");
            }
            this.centroid = json.centroid;
            return json;
        }
        catch (er) {
            if (er instanceof DataError)
                throw (er);
            else
                throw new Error(`Fetch for "${query}" failed.`);
        }
    }
    /**
      * Side Effects: updates $svg and layers using data from OSM
      * @todo see TODO below
      */
    drawOSM(json) {
        // Parse response
        const elements = json.elements;
        // Decide which layer each element belongs to
        for (let ele of elements) {
            /*
            layer = this.getLayer(ele)
            layer.addGeometry(ele)
      
            HELPERS
            this.getLayer(tags: Tag[]): Layer   (HELPER in this class)
              (Returns FIRST matching layer)
              - For each layer in `layers`
                - For each layerTag in `layer.tags`
                  - If layerTag matches `ele.tags`
                    - return layer
          
            layer.matches(tag: Tag): boolean
              (Return true as soon as a match is detected)
              - if layer.tag value is null
      
            this.extractRelationGeom(element) (HELPER in this class)
              - extract geometry into a nested list where first array is outer boundary
                  and subsequent arrays are inner boundaries
            */
            if (!(ele.type === "way"))
                continue; // TODO - handle relations
            /*
              - if element is a "way"
                - geom = element.geometry
              - if element is a "relation"
                - geom = extractRelationGeom(element)
              - path = SVG.makeSVGPath(geom)
            */
            const layer = this.getLayer(ele);
            if (!(layer instanceof Layer)) {
                console.warn("Layer not found for", ele);
            }
            else {
                const points = ele.geometry
                    .map(p => OSM.convertPoint(p))
                    .map(this.mapPointToSVG, this);
                const path = SVG.makePath(points);
                layer.addGeometry(path);
            }
        }
        // 
    }
    getLayer(ele) {
        const tags = ele.tags;
        for (let layer of this.layers) {
            if (layer.matchesTags(tags)) {
                return layer;
            }
        }
        return ele;
    }
    /**
     * A simple testing function.  Do not use in production.
     */
    async test() {
        const response = await fetch("./data/durham_nc.json");
        const json = await response.json();
        if (json.bbox) {
            this.bbox.parseLatitudeFirst(json.bbox);
        }
        else {
            throw new Error("no bbox was found");
        }
        this.centroid = json.centroid;
        const elements = json.elements;
        // Example for Durham, NC: [35.9857, -78.9154, 36.0076, -78.8882]
        const svg = this.$svg;
        svg.setAttribute("width", String(this.svgWidth));
        svg.setAttribute("height", String(this.svgHeight));
        svg.setAttribute("viewBox", `0 0 ${this.svgWidth} ${this.svgHeight}`);
        // this.bbox.crop(this.svgWidth, this.svgHeight);
        let rect = SVG.makeElement("rect");
        rect.setAttribute("x", String(0));
        rect.setAttribute("y", String(0));
        rect.setAttribute("width", String(this.svgWidth));
        rect.setAttribute("height", String(this.svgHeight));
        rect.setAttribute("fill", "rgba(153, 6, 167, 1)");
        svg.append(rect);
        let g = SVG.makeElement("g");
        // g.setAttribute("transform", "scale(1, -1)");
        g.setAttribute("stroke", "white");
        g.setAttribute("fill", "none");
        g.setAttribute("stroke-width", "3");
        svg.append(g);
        // Diagonal top left to bottom right
        // let path = SVG.makeSVGPath([[this.bbox.minLon, this.bbox.maxLat], [this.bbox.maxLon, this.bbox.minLat]]);
        // let path = SVG.makeSVGPath([[0, 0], [this.svgWidth, this.svgHeight]]);
        // g.append(path);
        // test the cropBox
        // if (this.bbox.isValid()) {
        //   rect = SVG.makeSVGElement("rect");
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
        g = SVG.makeElement("g");
        // g.setAttribute("transform", "scale(1, -1)");
        g.setAttribute("stroke", "rgba(80, 0, 0, 1)");
        g.setAttribute("fill", "rgba(255, 82, 241, 0.27)");
        g.setAttribute("stroke-width", "0.5");
        svg.append(g);
        // debugger;
        for (let ele of elements) {
            if (ele.type !== "way")
                continue;
            const mappedPoints = ele.geometry.map((point) => {
                return this.mapOSMPointToSVG(point);
            }).map(OSMPoint => [OSMPoint.lon, OSMPoint.lat]);
            const shape = SVG.makePath(mappedPoints);
            g.append(shape);
        }
        document.body.append(svg);
    }
    /**
     * Re-map OSM point coordinates from `bbox` coordinate system to svg coord. sys.
     */
    mapOSMPointToSVG(pt, precision = 3) {
        if (!this.bbox.isValid())
            throw new Error("Only works with valid bbox");
        return {
            lat: Number(U.map(pt.lat, this.bbox.top, this.bbox.bottom, 0, this.svgHeight).toFixed(precision)),
            lon: Number(U.map(pt.lon, this.bbox.left, this.bbox.right, 0, this.svgWidth).toFixed(precision))
        };
    }
    /**
     * Remap a standard point `[x, y]` to SVG coord. sys.
     */
    mapPointToSVG(pt) {
        if (!this.bbox.isValid())
            throw new Error("Only works with valid bbox");
        return [
            U.map(pt[0], this.bbox.left, this.bbox.right, 0, this.svgWidth),
            U.map(pt[1], this.bbox.top, this.bbox.bottom, 0, this.svgHeight)
        ];
    }
}
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// MAIN LOOP
document.addEventListener("DOMContentLoaded", async () => {
    const $container = document.querySelector("section.app");
    if (!$container)
        throw new Error("Container not found");
    const app = new MapApp($container);
    const json = await app.fetchOSM("./data/durham_nc.json");
    console.log(json);
    console.log(app.bbox);
    app.drawOSM(json);
    // app.test();
    const layers = Layer.makeDefaultLayers();
    console.log(layers);
    console.log("Setup is done");
});
export {};
